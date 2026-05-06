import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ToolTaskDocument = HydratedDocument<ToolTask>;

export type ToolTaskType = 'objective_grading' | 'essay_batch';
export type ToolTaskStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partial_failed'
  | 'failed'
  | 'cancelled';

@Schema({ timestamps: true, collection: 'tool_tasks' })
export class ToolTask {
  @Prop({ required: true, enum: ['objective_grading', 'essay_batch'], index: true })
  type: ToolTaskType;

  @Prop({ required: true, index: true })
  teacherId: string;

  @Prop({ required: true, trim: true })
  teacherName: string;

  @Prop({ type: String, default: null, index: true })
  classId?: string | null;

  @Prop({ type: String, default: null })
  className?: string | null;

  @Prop({ type: String, default: null, index: true })
  assignmentId?: string | null;

  @Prop({ type: String, default: null })
  assignmentTitle?: string | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    enum: [
      'queued',
      'processing',
      'completed',
      'partial_failed',
      'failed',
      'cancelled',
    ],
    default: 'queued',
    index: true,
  })
  status: ToolTaskStatus;

  @Prop({ default: 0 })
  totalCount: number;

  @Prop({ default: 0 })
  processedCount: number;

  @Prop({ default: 0 })
  successCount: number;

  @Prop({ default: 0 })
  failureCount: number;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ type: Array, default: [] })
  items: Array<Record<string, unknown>>;

  @Prop({ type: Object, default: {} })
  resultSummary: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  createdAt?: Date;

  updatedAt?: Date;
}

export const ToolTaskSchema = SchemaFactory.createForClass(ToolTask);
ToolTaskSchema.index({ teacherId: 1, createdAt: -1 });
ToolTaskSchema.index({ type: 1, status: 1, createdAt: -1 });
