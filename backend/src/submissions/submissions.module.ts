import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AppService } from '../app.service';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipSchema } from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AiReviewConfigService } from './ai-review-config.service';
import { AI_REVIEW_QUEUE } from './ai-review.constants';
import { AiReviewProcessor } from './ai-review.processor';
import { AiReviewQueueService } from './ai-review-queue.service';
import { DoubaoAiReviewService } from './doubao-ai-review.service';
import { Submission, SubmissionSchema } from './schemas/submission.schema';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: AI_REVIEW_QUEUE,
    }),
    MongooseModule.forFeature([
      { name: Submission.name, schema: SubmissionSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    SubmissionsService,
    AppService,
    AiReviewConfigService,
    DoubaoAiReviewService,
    AiReviewQueueService,
    AiReviewProcessor,
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
