import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ClassMembership, ClassMembershipSchema } from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { Submission, SubmissionSchema } from '../submissions/schemas/submission.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
      { name: Submission.name, schema: SubmissionSchema },
    ]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
