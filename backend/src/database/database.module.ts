import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipSchema } from '../classes/schemas/class-membership.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DatabaseSeedService } from './database-seed.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const configuredUri = configService.get<string>('MONGODB_URI');
        if (configuredUri) {
          return {
            uri: configuredUri,
          };
        }

        const memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'nengdou_ai',
          },
        });

        return {
          uri: memoryServer.getUri(),
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
  providers: [DatabaseSeedService],
})
export class DatabaseModule {}
