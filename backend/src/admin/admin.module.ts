import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from '../app.service';
import { AuthModule } from '../auth/auth.module';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { Submission, SubmissionSchema } from '../submissions/schemas/submission.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AiModelsController } from './ai-models.controller';
import { AiModelsPublicController } from './ai-models-public.controller';
import { AiModelsService } from './ai-models.service';
import { AiModel, AiModelSchema } from './schemas/ai-model.schema';

@Module({
  controllers: [AdminController, AiModelsController, AiModelsPublicController],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Submission.name, schema: SubmissionSchema },
      { name: AiModel.name, schema: AiModelSchema },
    ]),
  ],
  providers: [AdminService, AiModelsService, AppService],
  exports: [AdminService, AiModelsService],
})
export class AdminModule {}
