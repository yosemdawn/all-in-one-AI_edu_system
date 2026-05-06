import '../config/preload-env';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModel, AiModelSchema } from '../admin/schemas/ai-model.schema';
import { AppService } from '../app.service';
import {
  Assignment,
  AssignmentSchema,
} from '../assignments/schemas/assignment.schema';
import { AuthModule } from '../auth/auth.module';
import {
  ClassMembership,
  ClassMembershipSchema,
} from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { TEACHER_TOOLS_QUEUE } from './teacher-tools.constants';
import { DoubaoVisionService } from './doubao-vision.service';
import { ObjectiveGradingService } from './objective-grading.service';
import { ToolTask, ToolTaskSchema } from './schemas/tool-task.schema';
import {
  Submission,
  SubmissionSchema,
} from '../submissions/schemas/submission.schema';
import { TeacherToolsController } from './teacher-tools.controller';
import { TeacherToolsProcessor } from './teacher-tools.processor';
import { TeacherToolsQueueService } from './teacher-tools-queue.service';
import { TeacherToolsService } from './teacher-tools.service';

const redisUrl = process.env.REDIS_URL;
const queueImports = redisUrl
  ? [
      BullModule.registerQueue({
        name: TEACHER_TOOLS_QUEUE,
      }),
    ]
  : [];

const queueProviders = redisUrl
  ? [TeacherToolsQueueService, TeacherToolsProcessor]
  : [];

@Module({
  controllers: [TeacherToolsController],
  imports: [
    AuthModule,
    ...queueImports,
    MongooseModule.forFeature([
      { name: ToolTask.name, schema: ToolTaskSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
      { name: AiModel.name, schema: AiModelSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Submission.name, schema: SubmissionSchema },
    ]),
  ],
  providers: [
    TeacherToolsService,
    DoubaoVisionService,
    ObjectiveGradingService,
    AppService,
    ...queueProviders,
  ],
  exports: [TeacherToolsService],
})
export class TeacherToolsModule {}
