import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubmissionDocument = HydratedDocument<Submission>;

@Schema({ timestamps: true, collection: 'submissions' })
export class Submission {
  @Prop({ required: true, index: true })
  assignmentId: string;

  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ required: true, trim: true })
  studentName: string;

  @Prop()
  studentNumber?: string;

  @Prop({ required: true, index: true })
  classId: string;

  @Prop({ required: true, trim: true })
  className: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Array, default: [] })
  attachments: Array<Record<string, unknown>>;

  @Prop({
    required: true,
    enum: ['draft', 'submitted', 'ai_review_queued', 'ai_reviewed', 'teacher_reviewed', 'ai_review_failed'],
    default: 'draft',
  })
  status:
    | 'draft'
    | 'submitted'
    | 'ai_review_queued'
    | 'ai_reviewed'
    | 'teacher_reviewed'
    | 'ai_review_failed';

  @Prop({ default: true })
  isDraft: boolean;

  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;

  @Prop({ default: 0 })
  submissionCount: number;

  @Prop({ type: Number, default: null })
  aiScore?: number | null;

  @Prop({ type: String, default: null })
  aiReviewContent?: string | null;

  @Prop({ type: Object, default: null })
  aiReviewMetadata?: Record<string, unknown> | null;

  @Prop({ type: Date, default: null })
  aiReviewedAt?: Date | null;

  @Prop({ type: Number, default: null })
  teacherScore?: number | null;

  @Prop({ type: String, default: null })
  teacherReviewContent?: string | null;

  @Prop({ type: Date, default: null })
  teacherReviewedAt?: Date | null;

  createdAt?: Date;

  updatedAt?: Date;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);
SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
