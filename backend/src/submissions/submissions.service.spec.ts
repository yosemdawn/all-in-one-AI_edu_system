import { SubmissionsService } from './submissions.service';

describe('SubmissionsService queue compensation', () => {
  function createService(options: {
    queueService?: { enqueueReview: jest.Mock };
    aiReviewRequired?: boolean;
  }) {
    const membershipModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SubmissionsService(
      {} as never,
      {} as never,
      {} as never,
      membershipModel as never,
      {} as never,
      {} as never,
      { aiReviewRequired: options.aiReviewRequired ?? true } as never,
      options.queueService as never,
    );
    return { service, membershipModel };
  }

  it('marks a persisted submission as failed when Redis enqueue fails', async () => {
    const queueService = {
      enqueueReview: jest.fn().mockRejectedValue(new Error('Redis offline')),
    };
    const { service, membershipModel } = createService({ queueService });
    const item = {
      id: 'submission-1',
      classId: 'class-1',
      studentId: 'student-1',
      submissionCount: 1,
      submittedAt: new Date(),
      status: 'submitted',
      aiReviewMetadata: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      (service as any).markAiReviewQueued(item),
    ).resolves.toBeUndefined();

    expect(queueService.enqueueReview).toHaveBeenCalledWith('submission-1');
    expect(item.status).toBe('ai_review_failed');
    expect(item.aiReviewMetadata).toEqual(
      expect.objectContaining({
        queueStatus: 'failed',
        error: 'Redis offline',
      }),
    );
    expect(item.save).toHaveBeenCalledTimes(2);
    expect(membershipModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('marks a required review as failed when no queue is configured', async () => {
    const { service } = createService({ aiReviewRequired: true });
    const item = {
      id: 'submission-2',
      classId: 'class-1',
      studentId: 'student-1',
      submissionCount: 1,
      submittedAt: new Date(),
      status: 'submitted',
      aiReviewMetadata: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await (service as any).markAiReviewQueued(item);

    expect(item.status).toBe('ai_review_failed');
    expect(item.aiReviewMetadata).toEqual(
      expect.objectContaining({ queueStatus: 'failed' }),
    );
  });

  it('exposes downloadable attachment metadata without leaking storage paths', () => {
    const { service } = createService({ aiReviewRequired: false });
    const payload = (service as any).toSubmissionPayload({
      _id: 'submission-3',
      attachments: [
        {
          id: 'attachment-1',
          fileName: 'answer.pdf',
          fileSize: 123,
          fileType: 'application/pdf',
          storagePath: 'uploads/submissions/student-1/attachment-1.pdf',
        },
      ],
    });

    expect(payload.attachments).toEqual([
      {
        id: 'attachment-1',
        fileName: 'answer.pdf',
        fileSize: 123,
        fileType: 'application/pdf',
        fileUrl:
          '/students/submissions/submission-3/attachments/attachment-1',
      },
    ]);
    expect(payload.attachments[0].storagePath).toBeUndefined();
  });
});
