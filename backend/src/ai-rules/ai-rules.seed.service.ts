import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiRule, AiRuleDocument } from './schemas/ai-rule.schema';

@Injectable()
export class AiRulesSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(AiRule.name)
    private readonly aiRuleModel: Model<AiRuleDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.aiRuleModel.updateOne(
      { _id: 'rule-1' },
      {
        $setOnInsert: {
          _id: 'rule-1',
          name: 'Default Review Rule',
          description: 'Seeded default AI review rule',
          modelType: 'doubao',
          prompt: 'Provide a score and concise suggestions based on the answer.',
          visibility: 'system',
          status: 'active',
          tags: ['default', 'reading'],
          createdById: 'system',
          createdByName: 'System',
        },
      },
      { upsert: true },
    );
  }
}
