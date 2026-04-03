import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AppService } from '../app.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassMembership, ClassMembershipSchema } from './schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from './schemas/class.schema';

@Module({
  controllers: [ClassesController],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
    ]),
  ],
  providers: [ClassesService, AppService],
  exports: [ClassesService],
})
export class ClassesModule {}
