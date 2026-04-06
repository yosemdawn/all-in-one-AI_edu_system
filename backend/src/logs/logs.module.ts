import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from '../app.service';
import { AuthModule } from '../auth/auth.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import { LogEntry, LogEntrySchema } from './schemas/log-entry.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: LogEntry.name, schema: LogEntrySchema },
    ]),
  ],
  controllers: [LogsController],
  providers: [LogsService, RequestLoggingMiddleware, AppService],
  exports: [LogsService],
})
export class LogsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
