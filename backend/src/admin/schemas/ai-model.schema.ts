import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiModelDocument = HydratedDocument<AiModel>;

@Schema({ timestamps: true, collection: 'ai_models' })
export class AiModel {
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  provider: string;

  @Prop({ required: true, trim: true })
  modelName: string;

  @Prop({ required: true, trim: true })
  baseUrl: string;

  @Prop({ default: '' })
  apiKey: string;

  @Prop({ default: '' })
  accessKey?: string;

  @Prop({ default: '' })
  secretKey?: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: 0 })
  totalUsage: number;

  @Prop({ default: 0 })
  totalTokens: number;

  @Prop()
  lastUsedAt?: Date;

  @Prop({ default: 0 })
  lastBalance: number;

  @Prop({ default: 'CNY' })
  balanceCurrency: string;

  @Prop()
  lastBalanceCheck?: Date;

  createdAt?: Date;

  updatedAt?: Date;
}

export const AiModelSchema = SchemaFactory.createForClass(AiModel);
