import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AppService } from '../app.service';
import { ClassMembership, ClassMembershipSchema } from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { Submission, SubmissionSchema } from '../submissions/schemas/submission.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AssignmentsService } from './assignments.service';
import { Assignment, AssignmentSchema } from './schemas/assignment.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
      { name: Submission.name, schema: SubmissionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [AssignmentsService, AppService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
