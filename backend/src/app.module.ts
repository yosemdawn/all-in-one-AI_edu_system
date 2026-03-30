import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AiRulesModule } from './ai-rules/ai-rules.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AuthModule } from './auth/auth.module';
import { ClassEntity, ClassSchema } from './classes/schemas/class.schema';
import { ClassMembership, ClassMembershipSchema } from './classes/schemas/class-membership.schema';
import { ClassesModule } from './classes/classes.module';
import { validateEnvironment } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { User, UserSchema } from './users/schemas/user.schema';
import { UsersModule } from './users/users.module';

const redisUrl = process.env.REDIS_URL;
const queueImports = redisUrl
  ? [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          connection: {
            url: configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379',
          },
        }),
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    ...queueImports,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
    ]),
    AuthModule,
    UsersModule,
    ClassesModule,
    AssignmentsModule,
    SubmissionsModule,
    AiRulesModule,
    DashboardModule,
    PermissionsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
