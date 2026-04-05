import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ unique: true, sparse: true, trim: true })
  studentId?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, unknown>;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ['superadmin', 'teacher', 'student'] })
  role: 'superadmin' | 'teacher' | 'student';

  @Prop({
    required: true,
    enum: ['active', 'inactive', 'locked'],
    default: 'active',
  })
  status: 'active' | 'inactive' | 'locked';

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: false })
  mustChangePassword?: boolean;

  @Prop()
  classId?: string;

  @Prop()
  className?: string;

  @Prop()
  firstLoginAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  passwordChangedAt?: Date;

  @Prop()
  lastLogoutAt?: Date;

  @Prop({ type: String, default: null })
  passwordResetTokenHash?: string | null;

  @Prop({ type: String, default: null, index: true, sparse: true })
  passwordResetTokenFingerprint?: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt?: Date | null;

  @Prop({ default: 0 })
  tokenVersion?: number;

  createdAt?: Date;

  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
