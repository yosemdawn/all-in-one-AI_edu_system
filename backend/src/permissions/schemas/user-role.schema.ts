import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserRoleAssignmentDocument = HydratedDocument<UserRoleAssignment>;

@Schema({ timestamps: true, collection: 'user_role_assignments' })
export class UserRoleAssignment {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: [String], default: [] })
  roleIds: string[];

  @Prop()
  assignedBy?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const UserRoleAssignmentSchema =
  SchemaFactory.createForClass(UserRoleAssignment);
