import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AssignmentDocument = HydratedDocument<Assignment>;

@Schema({ timestamps: true, collection: 'assignments' })
export class Assignment {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, index: true })
  teacherId: string;

  @Prop({ required: true, trim: true })
  teacherName: string;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
      },
    ],
    default: [],
  })
  classes: Array<{ id: string; name: string }>;

  @Prop({ type: Object, default: null })
  aiRule?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  questionMaterial?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  referenceAnswer?: Record<string, unknown> | null;

  @Prop({ default: '' })
  gradingNotes?: string;

  @Prop({ enum: ['answer_sheet', 'answers_only', 'mixed'], default: 'answers_only' })
  submissionFormat?: 'answer_sheet' | 'answers_only' | 'mixed';

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: false })
  allowAttachments?: boolean;

  @Prop({ required: true, enum: ['draft', 'published', 'terminated'], default: 'draft' })
  status: 'draft' | 'published' | 'terminated';

  @Prop()
  terminatedReason?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
