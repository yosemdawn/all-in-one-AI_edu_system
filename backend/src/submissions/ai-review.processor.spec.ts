import type { Job } from 'bullmq';
import { AiReviewProcessor } from './ai-review.processor';

describe('AiReviewProcessor', () => {
  type ProcessorDependencies = ConstructorParameters<typeof AiReviewProcessor>;
  type SavedState = {
    status?: string;
    aiReviewMetadata?: {
      queueStatus?: string;
      error?: string;
    };
  };

  it('marks submissions as failed when AI review fails', async () => {
    const savedStates: SavedState[] = [];
    const submission = {
      id: 'submission-1',
      assignmentId: 'assignment-1',
      classId: 'class-1',
      studentId: 'student-1',
      submissionCount: 1,
      submittedAt: new Date('2026-04-03T12:00:00.000Z'),
      status: 'ai_review_queued',
      aiScore: null,
      aiReviewContent: null,
      aiReviewedAt: null,
      aiReviewMetadata: { queuedAt: '2026-04-03T12:00:01.000Z' },
      save: jest.fn().mockImplementation(() => {
        savedStates.push({
          status: submission.status,
          aiReviewMetadata: submission.aiReviewMetadata,
        });
        return Promise.resolve();
      }),
    };

    const submissionModel = {
      findById: jest.fn().mockResolvedValue(submission),
    };
    const assignmentModel = {
      findById: jest.fn().mockResolvedValue({
        id: 'assignment-1',
        teacherId: 'teacher-1',
      }),
    };
    const aiModelModel = {
      updateOne: jest.fn(),
    };
    const membershipModel = {
      findOneAndUpdate: jest.fn(),
    };
    const userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ aiSettings: {} }),
        }),
      }),
    };
    const doubaoAiReviewService = {
      review: jest.fn().mockResolvedValue({
        success: false,
        error: 'Missing DOUBAO_API_KEY',
      }),
    };

    const processor = new AiReviewProcessor(
      submissionModel as unknown as ProcessorDependencies[0],
      assignmentModel as unknown as ProcessorDependencies[1],
      aiModelModel as unknown as ProcessorDependencies[2],
      membershipModel as unknown as ProcessorDependencies[3],
      userModel as unknown as ProcessorDependencies[4],
      doubaoAiReviewService as unknown as ProcessorDependencies[5],
    );
    const job = {
      id: 'job-1',
      data: { submissionId: 'submission-1' },
    } as unknown as Job<{ submissionId: string }>;

    await expect(processor.process(job)).rejects.toThrow(
      'Missing DOUBAO_API_KEY',
    );

    expect(savedStates.at(-1)?.status).toBe('ai_review_failed');
    expect(savedStates.at(-1)?.aiReviewMetadata?.queueStatus).toBe('failed');
    expect(savedStates.at(-1)?.aiReviewMetadata?.error).toBe(
      'Missing DOUBAO_API_KEY',
    );
  });
});
