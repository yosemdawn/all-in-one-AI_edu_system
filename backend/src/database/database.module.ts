import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipSchema } from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DatabaseSeedService } from './database-seed.service';
import { MemoryDatabaseService } from './memory-database.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        if (configService.get<string>('NODE_ENV') === 'test') {
          const testUri = configService.get<string>('TEST_MONGODB_URI');
          return {
            uri: testUri ?? 'mongodb://127.0.0.1:27017/nengdou_ai_test',
          };
        }

        const configuredUri = configService.get<string>('MONGODB_URI');
        if (configuredUri) {
          return {
            uri: configuredUri,
          };
        }

        return {
          uri: 'mongodb://127.0.0.1:27017/nengdou_ai',
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: ClassMembership.name, schema: ClassMembershipSchema },
      { name: Assignment.name, schema: AssignmentSchema },
    ]),
  ],
  providers: [DatabaseSeedService, MemoryDatabaseService],
})
export class DatabaseModule {}
