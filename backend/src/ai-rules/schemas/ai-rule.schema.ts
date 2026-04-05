import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiRuleDocument = HydratedDocument<AiRule>;

@Schema({ timestamps: true, collection: 'ai_rules' })
export class AiRule {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ required: true, enum: ['doubao', 'deepseek'], default: 'doubao' })
  modelType: 'doubao' | 'deepseek';

  @Prop({ required: true })
  prompt: string;

  @Prop({
    required: true,
    enum: ['private', 'public', 'system'],
    default: 'private',
  })
  visibility: 'private' | 'public' | 'system';

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  createdById?: string;

  @Prop()
  createdByName?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const AiRuleSchema = SchemaFactory.createForClass(AiRule);
