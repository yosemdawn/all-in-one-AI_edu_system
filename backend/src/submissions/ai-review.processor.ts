import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
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
    private readonly doubaoAiReviewService: DoubaoAiReviewService,
  ) {
    super();
  }

  async process(job: Job<{ submissionId: string }>) {
    const submission = await this.submissionModel.findById(
      job.data.submissionId,
    );
    if (!submission) {
      this.logger.warn(`Submission not found: ${job.data.submissionId}`);
      return;
    }

    const assignment = await this.assignmentModel.findById(
      submission.assignmentId,
    );
    if (!assignment) {
      submission.status = 'ai_review_failed';
      submission.aiReviewMetadata = {
        provider: 'doubao',
        queueStatus: 'failed',
        error: 'Assignment not found',
        failedAt: new Date().toISOString(),
      };
      await submission.save();
      return;
    }

    submission.status = 'ai_review_queued';
    submission.aiReviewMetadata = {
      provider: 'doubao',
      modelUsed: 'doubao-seed-2-0-lite-260215',
      queueStatus: 'processing',
      jobId: String(job.id),
      queuedAt:
        submission.aiReviewMetadata?.queuedAt || new Date().toISOString(),
      processingStartedAt: new Date().toISOString(),
    };
    await submission.save();

    const result = await this.doubaoAiReviewService.review(
      submission,
      assignment,
    );

    if (!result.success) {
      submission.status = 'ai_review_failed';
      submission.aiScore = null;
      submission.aiReviewContent = null;
      submission.aiReviewedAt = null;
      submission.aiReviewMetadata = {
        provider: 'doubao',
        modelUsed: 'doubao-seed-2-0-lite-260215',
        queueStatus: 'failed',
        error: result.error,
        rawContent: result.rawContent,
        failedAt: new Date().toISOString(),
      };
      await submission.save();
      throw new Error(result.error || 'AI review failed');
    }

    submission.status = 'ai_reviewed';
    submission.aiScore = result.score;
    submission.aiReviewContent = result.review;
    submission.aiReviewedAt = new Date();
    submission.aiReviewMetadata = {
      provider: 'doubao',
      modelUsed: result.model || 'doubao-seed-2-0-lite-260215',
      queueStatus: 'completed',
      usage: result.usage,
      tokenUsed: this.resolveUsageTokens(result.usage),
      highlights: result.highlights,
      rawContent: result.rawContent,
      completedAt: new Date().toISOString(),
    };
    await submission.save();

    await this.aiModelModel.updateOne(
      { code: 'doubao' },
      {
        $inc: {
          totalUsage: 1,
          totalTokens: this.resolveUsageTokens(result.usage),
        },
        $set: {
          lastUsedAt: submission.aiReviewedAt || new Date(),
        },
      },
    );

    await this.membershipModel.findOneAndUpdate(
      { classId: submission.classId, studentId: submission.studentId },
      {
        $set: {
          totalSubmissions: submission.submissionCount,
          lastSubmissionTime: submission.submittedAt || new Date(),
        },
      },
    );
  }

  private resolveUsageTokens(usage: Record<string, unknown> | undefined) {
    const totalTokensValue = Number(
      usage?.total_tokens || usage?.totalTokens || 0,
    );
    return Number.isFinite(totalTokensValue) ? totalTokensValue : 0;
  }
}
