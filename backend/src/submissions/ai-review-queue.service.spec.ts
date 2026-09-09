import { AiReviewQueueService } from './ai-review-queue.service';

describe('AI review job identity', () => {
  it('deduplicates requests for one content revision while allowing the next revision', async () => {
    const queue = {
      add: jest
        .fn<
          Promise<unknown>,
          [
            string,
            { submissionId: string; revision: number },
            { jobId: string },
          ]
        >()
        .mockResolvedValue(undefined),
    };
    const service = new AiReviewQueueService(queue as never);
    await service.enqueueReview('submission-1', 1);
    await service.enqueueReview('submission-1', 1);
    await service.enqueueReview('submission-1', 2);
    expect(queue.add.mock.calls[0][1]).toEqual({
      submissionId: 'submission-1',
      revision: 1,
    });
    expect(queue.add.mock.calls[0][2].jobId).toBe(
      queue.add.mock.calls[1][2].jobId,
    );
    expect(queue.add.mock.calls[0][2].jobId).not.toBe(
      queue.add.mock.calls[2][2].jobId,
    );
  });
});
