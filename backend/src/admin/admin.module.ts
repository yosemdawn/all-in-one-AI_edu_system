import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from '../app.service';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { Submission, SubmissionSchema } from '../submissions/schemas/submission.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminService } from './admin.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Submission.name, schema: SubmissionSchema },
    ]),
  ],
  providers: [AdminService, AppService],
  exports: [AdminService],
})
export class AdminModule {}
