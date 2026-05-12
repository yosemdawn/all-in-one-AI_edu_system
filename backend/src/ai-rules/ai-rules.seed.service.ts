import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiRule, AiRuleDocument } from './schemas/ai-rule.schema';

export const DEFAULT_AI_REVIEW_RULE_PROMPT = [
  '请根据作业要求、参考答案和学生提交内容进行批改。',
  '请给出 0-100 分的分数，并用简体中文提供简洁、具体、可执行的改进建议。',
  '反馈应指出主要优点、主要问题和下一步怎么改，避免空泛评价。',
].join('\n');

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
        $set: {
          name: '默认中文批改规则',
          description: '系统默认 AI 中文批改规则',
          modelType: 'doubao',
          prompt: DEFAULT_AI_REVIEW_RULE_PROMPT,
          visibility: 'system',
          status: 'active',
          tags: ['default', '中文批改'],
          createdById: 'system',
          createdByName: 'System',
        },
        $setOnInsert: {
          _id: 'rule-1',
        },
      },
      { upsert: true },
    );
  }
}
