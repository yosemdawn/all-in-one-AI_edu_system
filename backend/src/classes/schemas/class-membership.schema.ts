import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClassMembershipDocument = HydratedDocument<ClassMembership>;

@Schema({ timestamps: true, collection: 'class_memberships' })
export class ClassMembership {
  @Prop({ required: true, index: true })
  classId: string;

  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ required: true, trim: true })
  studentName: string;

  @Prop()
  studentNumber?: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop({ required: true, enum: ['code', 'teacher', 'register', 'import'] })
  joinMethod: 'code' | 'teacher' | 'register' | 'import';

  @Prop({ required: true })
  joinedAt: Date;

  @Prop({ default: 0 })
  totalSubmissions: number;

  @Prop({ type: Date, default: null })
  lastSubmissionTime?: Date | null;
}

export const ClassMembershipSchema = SchemaFactory.createForClass(ClassMembership);
ClassMembershipSchema.index({ classId: 1, studentId: 1 }, { unique: true });
