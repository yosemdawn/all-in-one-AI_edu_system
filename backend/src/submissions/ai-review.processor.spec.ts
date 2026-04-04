import { AiReviewProcessor } from './ai-review.processor';

describe('AiReviewProcessor', () => {
  it('marks submissions as failed when AI review fails', async () => {
    const savedStates: Array<Record<string, any>> = [];
    const submission = {
      id: 'submission-1',
      assignmentId: 'assignment-1',
      classId: 'class-1',
      studentId: 'student-1',
      submissionCount: 1,
      submittedAt: new Date('2026-04-03T12:00:00.000Z'),
      aiReviewMetadata: { queuedAt: '2026-04-03T12:00:01.000Z' },
      save: jest.fn().mockImplementation(async function save(this: any) {
        savedStates.push({
          status: this.status,
          aiReviewMetadata: this.aiReviewMetadata,
        });
      }),
    };

    const submissionModel = {
      findById: jest.fn().mockResolvedValue(submission),
    };
    const assignmentModel = {
      findById: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
    };
    const aiModelModel = {
      updateOne: jest.fn(),
    };
    const membershipModel = {
      findOneAndUpdate: jest.fn(),
    };
    const doubaoAiReviewService = {
      review: jest.fn().mockResolvedValue({
        success: false,
        error: '未配置 DOUBAO_API_KEY',
      }),
    };

    const processor = new AiReviewProcessor(
      submissionModel as any,
      assignmentModel as any,
      aiModelModel as any,
      membershipModel as any,
      doubaoAiReviewService as any,
    );

    await expect(
      processor.process({
        id: 'job-1',
        data: { submissionId: 'submission-1' },
      } as any),
    ).rejects.toThrow('未配置 DOUBAO_API_KEY');

    expect(savedStates.at(-1)?.status).toBe('ai_review_failed');
    expect(savedStates.at(-1)?.aiReviewMetadata.queueStatus).toBe('failed');
    expect(savedStates.at(-1)?.aiReviewMetadata.error).toBe(
      '未配置 DOUBAO_API_KEY',
    );
  });
});
