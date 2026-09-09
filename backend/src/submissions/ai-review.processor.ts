import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { revisionFilter, unreviewedFilter } from './submission-state';
import { Model, QueryFilter } from 'mongoose';
import { AiModel, AiModelDocument } from '../admin/schemas/ai-model.schema';
import {
  Assignment,
  AssignmentDocument,
} from '../assignments/schemas/assignment.schema';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../classes/schemas/class-membership.schema';
import { AI_REVIEW_QUEUE } from './ai-review.constants';
import { DoubaoAiReviewService } from './doubao-ai-review.service';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { decryptAiApiKey } from '../users/ai-api-key.crypto';
import {
  DEFAULT_DOUBAO_MODEL,
  resolveDoubaoModel,
} from '../common/doubao-models';

@Processor(AI_REVIEW_QUEUE)
export class AiReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(AiReviewProcessor.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(AiModel.name)
    private readonly aiModelModel: Model<AiModelDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly doubaoAiReviewService: DoubaoAiReviewService,
  ) {
    super();
  }

  async process(job: Job<{ submissionId: string; revision?: number }>) {
    const { submissionId, revision } = job.data;
    // A pre-upgrade job has no content version and must never grade newer work.
    if (!Number.isInteger(revision) || revision! < 1) {
      await this.submissionModel.updateOne(
        {
          _id: submissionId,
          ...revisionFilter(0),
          ...unreviewedFilter,
          isDraft: false,
          status: {
            $in: ['submitted', 'ai_review_queued', 'ai_review_failed'],
          },
        },
        {
          $set: {
            status: 'ai_review_failed',
            aiReviewMetadata: {
              queueStatus: 'failed',
              error:
                'Legacy AI job has no revision; teacher review is required',
            },
          },
        },
      );
      return;
    }
    const processingToken = randomUUID();
    const versionFilter: QueryFilter<Submission> = {
      _id: submissionId,
      revision,
      'aiDispatch.state': { $ne: 'done' },
      ...unreviewedFilter,
      isDraft: false,
      status: { $in: ['submitted', 'ai_review_queued', 'ai_review_failed'] },
    };
    const submission = await this.submissionModel.findOneAndUpdate(
      versionFilter,
      {
        $set: {
          status: 'ai_review_queued',
          aiReviewMetadata: {
            provider: 'doubao',
            queueStatus: 'processing',
            jobId: String(job.id),
            processingToken,
            processingStartedAt: new Date().toISOString(),
          },
        },
      },
      { returnDocument: 'after' },
    );
    if (!submission) return;
    const resultFilter = {
      ...versionFilter,
      'aiReviewMetadata.processingToken': processingToken,
    };
    try {
      const assignment = await this.assignmentModel.findById(
        submission.assignmentId,
      );
      if (!assignment) throw new Error('Assignment not found');
      const teacherAiSettings = await this.resolveTeacherAiSettings(assignment);
      const result = await this.doubaoAiReviewService.review(
        submission,
        assignment,
        teacherAiSettings,
      );
      if (!result.success) throw new Error(result.error || 'AI review failed');
      const reviewedAt = new Date();
      const updated = await this.submissionModel.updateOne(resultFilter, {
        $set: {
          status: 'ai_reviewed',
          aiDispatch: { state: 'done' },
          aiScore: result.score,
          aiReviewContent: result.review,
          aiReviewedAt: reviewedAt,
          aiReviewMetadata: {
            provider: 'doubao',
            modelUsed: result.model || teacherAiSettings.model,
            queueStatus: 'completed',
            usage: result.usage,
            tokenUsed: this.resolveUsageTokens(result.usage),
            highlights: result.highlights,
            rawContent: result.rawContent,
            completedAt: reviewedAt.toISOString(),
          },
        },
      });
      if (!updated.modifiedCount) return;
      await this.aiModelModel.updateOne(
        { code: 'doubao' },
        {
          $inc: {
            totalUsage: 1,
            totalTokens: this.resolveUsageTokens(result.usage),
          },
          $set: { lastUsedAt: reviewedAt },
        },
      );
    } catch (error) {
      // The same version/claim predicate protects manual reviews from failures too.
      const exhausted =
        (job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts || 1);
      const failed = await this.submissionModel.updateOne(resultFilter, {
        $set: {
          status: exhausted ? 'ai_review_failed' : 'ai_review_queued',
          ...(exhausted ? { aiDispatch: { state: 'done' } } : {}),
          aiReviewMetadata: {
            provider: 'doubao',
            queueStatus: exhausted ? 'failed' : 'retrying',
            [exhausted ? 'error' : 'lastError']:
              error instanceof Error ? error.message : 'AI review failed',
            failedAt: new Date().toISOString(),
          },
        },
      });
      if (failed.modifiedCount) throw error;
    }
  }

  private resolveUsageTokens(usage: Record<string, unknown> | undefined) {
    const totalTokensValue = Number(
      usage?.total_tokens || usage?.totalTokens || 0,
    );
    return Number.isFinite(totalTokensValue) ? totalTokensValue : 0;
  }

  private async resolveTeacherAiSettings(assignment: AssignmentDocument) {
    const teacher = await this.userModel
      .findById(assignment.teacherId)
      .select('aiSettings')
      .lean();

    const model = resolveDoubaoModel(teacher?.aiSettings?.doubaoModel);
    try {
      return {
        apiKey: decryptAiApiKey(teacher?.aiSettings?.doubaoApiKeyEncrypted),
        model,
      };
    } catch (error) {
      this.logger.error(
        `Failed to decrypt teacher AI key for teacher ${assignment.teacherId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        apiKey: '',
        model: model || DEFAULT_DOUBAO_MODEL,
      };
    }
  }
}
