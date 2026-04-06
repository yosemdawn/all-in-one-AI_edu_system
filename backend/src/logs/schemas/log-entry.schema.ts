import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LogEntryDocument = HydratedDocument<LogEntry>;

@Schema({ timestamps: true, collection: 'request_logs' })
export class LogEntry {
  @Prop({ trim: true })
  username?: string;

  @Prop({ trim: true, index: true })
  userId?: string;

  @Prop({ required: true, trim: true, index: true })
  ip: string;

  @Prop({ required: true, trim: true })
  method: string;

  @Prop({ required: true, trim: true, index: true })
  endpoint: string;

  @Prop({ required: true })
  statusCode: number;

  @Prop({ required: true, default: Date.now, index: true })
  timestamp: Date;

  @Prop({ required: true, default: 0 })
  responseTime: number;

  @Prop({ type: Object, default: null })
  requestParams?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  responseData?: Record<string, unknown> | null;

  createdAt?: Date;

  updatedAt?: Date;
}

export const LogEntrySchema = SchemaFactory.createForClass(LogEntry);
