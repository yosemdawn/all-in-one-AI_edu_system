import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import { AiReviewQueueService } from './ai-review-queue.service';
import { unreviewedFilter } from './submission-state';

const dispatchable: QueryFilter<Submission> = {
  ...unreviewedFilter,
  isDraft: false,
  status: { $in: ['submitted', 'ai_review_queued', 'ai_review_failed'] },
};

export function pendingAiDispatch() {
  return {
    state: 'pending',
    requestedAt: new Date(),
    nextAttemptAt: new Date(),
  };
}

@Injectable()
export class AiReviewDispatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiReviewDispatchService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    private readonly queue: AiReviewQueueService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep();
    }, 15000);
    this.timer.unref();
    void this.sweep();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      // Pre-upgrade tasks have no durable dispatch record. Make abandoned ones
      // retryable without guessing which content an old job belongs to.
      await this.submissions.updateMany(
        {
          aiDispatch: null,
          ...dispatchable,
          status: 'ai_review_queued',
          updatedAt: { $lt: new Date(Date.now() - 15 * 60000) },
        },
        {
          $set: {
            status: 'ai_review_failed',
            aiDispatch: { state: 'done' },
            aiReviewMetadata: {
              queueStatus: 'failed',
              error: '旧版 AI 任务已超时，请教师重试或人工批改',
            },
          },
        },
      );
      const rows = await this.submissions
        .find({
          'aiDispatch.state': { $in: ['pending', 'queued'] },
          'aiDispatch.nextAttemptAt': { $lte: new Date() },
          ...dispatchable,
        })
        .sort({ 'aiDispatch.nextAttemptAt': 1 })
        .limit(50)
        .select('_id revision')
        .lean();
      await Promise.all(
        rows.map((row) => this.deliver(row._id.toString(), row.revision)),
      );
    } catch {
      this.logger.warn('AI dispatch sweep unavailable; will retry');
    } finally {
      this.running = false;
    }
  }

  async deliver(id: string, revision: number) {
    // Lease is persisted; process termination simply delays the next sweep.
    const row = await this.submissions.findOneAndUpdate(
      {
        _id: id,
        revision,
        ...dispatchable,
        'aiDispatch.state': { $in: ['pending', 'queued'] },
        'aiDispatch.nextAttemptAt': { $lte: new Date() },
      },
      { $set: { 'aiDispatch.nextAttemptAt': new Date(Date.now() + 30000) } },
      { returnDocument: 'after' },
    );
    if (!row) return;
    const filter = {
      _id: id,
      revision,
      ...dispatchable,
      'aiDispatch.state': { $in: ['pending', 'queued'] },
    };
    try {
      const expired =
        Date.now() - new Date(row.aiDispatch!.requestedAt).getTime() >
        15 * 60_000;
      const state = expired
        ? 'expired'
        : await this.queue.ensureReview(id, revision);
      if (['failed', 'completed', 'expired'].includes(state)) {
        await this.submissions.updateOne(filter, {
          $set: {
            status: 'ai_review_failed',
            'aiDispatch.state': 'done',
            aiReviewMetadata: {
              queueStatus: 'failed',
              error: 'AI 任务未完成，请教师重试或人工批改',
              failedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        await this.submissions.updateOne(filter, {
          $set: {
            'aiDispatch.state': 'queued',
            'aiDispatch.nextAttemptAt': new Date(Date.now() + 30000),
          },
        });
      }
    } catch {
      // The durable pending record survives Redis disconnects and ambiguous enqueue responses.
      this.logger.warn(`AI dispatch deferred for submission ${id}`);
    }
  }
}
