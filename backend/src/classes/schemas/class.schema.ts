import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClassDocument = HydratedDocument<ClassEntity>;

@Schema({ timestamps: true, collection: 'classes' })
export class ClassEntity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, index: true })
  teacherId: string;

  @Prop({ required: true, trim: true })
  teacherName: string;

  @Prop({ required: true, enum: ['active', 'inactive', 'disbanded'], default: 'active' })
  status: 'active' | 'inactive' | 'disbanded';

  @Prop({ default: 0 })
  studentCount: number;

  @Prop({ default: 60 })
  maxStudents: number;

  @Prop({ default: '' })
  description?: string;
}

export const ClassSchema = SchemaFactory.createForClass(ClassEntity);
