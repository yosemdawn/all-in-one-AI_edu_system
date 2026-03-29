import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_REVIEW_QUEUE } from './ai-review.constants';

@Injectable()
export class AiReviewQueueService {
  constructor(@InjectQueue(AI_REVIEW_QUEUE) private readonly queue: Queue) {}

  async enqueueReview(submissionId: string) {
    await this.queue.add(
      'review-submission',
      { submissionId },
      {
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
