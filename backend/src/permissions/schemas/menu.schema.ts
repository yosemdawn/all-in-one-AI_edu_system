import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MenuDocument = HydratedDocument<Menu>;

@Schema({ timestamps: true, collection: 'permission_menus' })
export class Menu {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  path: string;

  @Prop()
  component?: string;

  @Prop()
  redirect?: string;

  @Prop({ required: true, enum: ['menu', 'button'], default: 'menu' })
  type: 'menu' | 'button';

  @Prop({ default: null })
  parentId?: string | null;

  @Prop()
  icon?: string;

  @Prop({ default: 0 })
  sort: number;

  @Prop({ default: false })
  hidden?: boolean;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop({ type: Object, default: {} })
  meta?: Record<string, unknown>;

  @Prop({ default: false })
  isSystem?: boolean;

  @Prop()
  createdBy?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const MenuSchema = SchemaFactory.createForClass(Menu);
