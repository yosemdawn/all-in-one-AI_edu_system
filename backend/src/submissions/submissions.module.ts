import '../config/preload-env';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModel, AiModelSchema } from '../admin/schemas/ai-model.schema';
import { AuthModule } from '../auth/auth.module';
import { AppService } from '../app.service';
import {
  Assignment,
  AssignmentSchema,
} from '../assignments/schemas/assignment.schema';
import {
  ClassMembership,
  ClassMembershipSchema,
} from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AiReviewConfigService } from './ai-review-config.service';
import { AI_REVIEW_QUEUE } from './ai-review.constants';
import { AiReviewProcessor } from './ai-review.processor';
import { AiReviewQueueService } from './ai-review-queue.service';
import { DoubaoAiReviewService } from './doubao-ai-review.service';
import { Submission, SubmissionSchema } from './schemas/submission.schema';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

const redisUrl = process.env.REDIS_URL;
const queueImports = redisUrl
  ? [
      BullModule.registerQueue({
        name: AI_REVIEW_QUEUE,
      }),
    ]
  : [];

const queueProviders = redisUrl
  ? [AiReviewQueueService, AiReviewProcessor]
  : [];

@Module({
  controllers: [SubmissionsController],
  imports: [
    AuthModule,
    ...queueImports,
    MongooseModule.forFeature([
      { name: Submission.name, schema: SubmissionSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
      { name: User.name, schema: UserSchema },
      { name: AiModel.name, schema: AiModelSchema },
    ]),
  ],
  providers: [
    SubmissionsService,
    AppService,
    AiReviewConfigService,
    DoubaoAiReviewService,
    ...queueProviders,
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
