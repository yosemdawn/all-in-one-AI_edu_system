import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

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
  ],
})
export class DatabaseModule {}
