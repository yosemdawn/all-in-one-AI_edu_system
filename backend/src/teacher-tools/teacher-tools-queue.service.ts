import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TEACHER_TOOLS_QUEUE } from './teacher-tools.constants';

@Injectable()
export class TeacherToolsQueueService {
  constructor(@InjectQueue(TEACHER_TOOLS_QUEUE) private readonly queue: Queue) {}

  async enqueueTask(taskId: string) {
    await this.queue.add(
      'process-tool-task',
      { taskId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}

