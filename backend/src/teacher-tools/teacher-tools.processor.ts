import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TEACHER_TOOLS_QUEUE } from './teacher-tools.constants';
import { TeacherToolsService } from './teacher-tools.service';

@Processor(TEACHER_TOOLS_QUEUE)
export class TeacherToolsProcessor extends WorkerHost {
  constructor(private readonly teacherToolsService: TeacherToolsService) {
    super();
  }

  async process(job: Job<{ taskId: string }>) {
    await this.teacherToolsService.processTask(job.data.taskId);
  }
}

