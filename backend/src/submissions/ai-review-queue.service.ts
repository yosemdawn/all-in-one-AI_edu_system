import { withTimeout } from '../common/with-timeout';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_REVIEW_QUEUE } from './ai-review.constants';

@Injectable()
export class AiReviewQueueService {
  constructor(@InjectQueue(AI_REVIEW_QUEUE) private readonly queue: Queue) {}

  async ensureReview(submissionId: string, revision: number): Promise<string> {
    const job = await withTimeout(
      this.queue.getJob(`review-${submissionId}-${revision}`),
      3000,
    );
    if (job) return withTimeout(job.getState(), 3000);
    await withTimeout(this.enqueueReview(submissionId, revision), 3000);
    return 'waiting';
  }

  async enqueueReview(submissionId: string, revision: number) {
    await this.queue.add(
      'review-submission',
      { submissionId, revision },
      {
        jobId: `review-${submissionId}-${revision}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  }
}
