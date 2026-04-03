import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'permission_roles' })
export class Role {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  menuIds: string[];

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop()
  remark?: string;

  @Prop()
  createdBy?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
