import './config/preload-env';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AiRulesModule } from './ai-rules/ai-rules.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AuthModule } from './auth/auth.module';
import { ClassEntity, ClassSchema } from './classes/schemas/class.schema';
import {
  ClassMembership,
  ClassMembershipSchema,
} from './classes/schemas/class-membership.schema';
import { ClassesModule } from './classes/classes.module';
import { validateEnvironment } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { LogsModule } from './logs/logs.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TeacherToolsModule } from './teacher-tools/teacher-tools.module';
import { User, UserSchema } from './users/schemas/user.schema';
import { UsersModule } from './users/users.module';

const redisUrl = process.env.REDIS_URL;
const DEFAULT_THROTTLE_TTL = 60_000;
const DEFAULT_THROTTLE_LIMIT = 120;
const DEFAULT_AUTH_THROTTLE_TTL = 60_000;
const DEFAULT_AUTH_THROTTLE_LIMIT = 10;
const queueImports = redisUrl
  ? [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          connection: {
            url:
              configService.get<string>('REDIS_URL') ||
              'redis://127.0.0.1:6379',
          },
        }),
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        errorMessage: 'Too many requests, please try again later.',
        skipIf: () => configService.get<string>('NODE_ENV') === 'test',
        throttlers: [
          {
            name: 'default',
            ttl: readPositiveNumber(
              configService.get<string>('THROTTLE_TTL'),
              DEFAULT_THROTTLE_TTL,
            ),
            limit: readPositiveNumber(
              configService.get<string>('THROTTLE_LIMIT'),
              DEFAULT_THROTTLE_LIMIT,
            ),
          },
          {
            name: 'auth',
            ttl: readPositiveNumber(
              configService.get<string>('AUTH_THROTTLE_TTL'),
              DEFAULT_AUTH_THROTTLE_TTL,
            ),
            limit: readPositiveNumber(
              configService.get<string>('AUTH_THROTTLE_LIMIT'),
              DEFAULT_AUTH_THROTTLE_LIMIT,
            ),
          },
        ],
      }),
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
    LogsModule,
    TeacherToolsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

function readPositiveNumber(
  rawValue: string | undefined,
  fallbackValue: number,
) {
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallbackValue;
}
