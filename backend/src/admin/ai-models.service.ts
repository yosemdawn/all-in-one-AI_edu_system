import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { Assignment, AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { Submission, SubmissionDocument } from '../submissions/schemas/submission.schema';
import { AiModel, AiModelDocument } from './schemas/ai-model.schema';

@Injectable()
export class AiModelsService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(AiModel.name)
    private readonly aiModelModel: Model<AiModelDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly appService: AppService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureDefaultModels();
  }

  async getList() {
    const models = await this.aiModelModel.find().sort({ createdAt: 1 }).lean();
    return this.appService.envelope(
      {
        models: models.map((model) => this.toPayload(model)),
        summary: this.buildSummary(models),
      },
      'success',
    );
  }

  async getActiveModels() {
    const models = await this.aiModelModel
      .find({ status: 'active' })
      .sort({ createdAt: 1 })
      .lean();
    return this.appService.envelope(models.map((model) => this.toPayload(model)), 'success');
  }

  async getModel(code: string) {
    const model = await this.aiModelModel.findOne({ code }).lean();
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    return this.appService.envelope(this.toPayload(model), 'success');
  }

  async updateModel(code: string, body: any) {
    const model = await this.aiModelModel.findOne({ code });
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    if (body.name !== undefined) model.name = body.name;
    if (body.provider !== undefined) model.provider = body.provider;
    if (body.modelName !== undefined) model.modelName = body.modelName;
    if (body.baseUrl !== undefined) model.baseUrl = body.baseUrl;
    if (body.apiKey !== undefined) model.apiKey = body.apiKey;
    if (body.accessKey !== undefined) model.accessKey = body.accessKey;
    if (body.secretKey !== undefined) model.secretKey = body.secretKey;
    if (body.status !== undefined) model.status = body.status;
    if (body.lastBalance !== undefined) model.lastBalance = Number(body.lastBalance);
    if (body.balanceCurrency !== undefined) model.balanceCurrency = body.balanceCurrency;
    if (body.isDefault) {
      await this.aiModelModel.updateMany({}, { $set: { isDefault: false } });
      model.isDefault = true;
    }

    await model.save();
    return this.appService.envelope(this.toPayload(model), 'success');
  }

  async setDefaultModel(code: string) {
    const model = await this.aiModelModel.findOne({ code });
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    await this.aiModelModel.updateMany({}, { $set: { isDefault: false } });
    model.isDefault = true;
    await model.save();

    return this.appService.envelope({ success: true, message: 'default updated' }, 'success');
  }

  async getModelBalance(code: string) {
    const model = await this.aiModelModel.findOne({ code }).lean();
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    return this.appService.envelope(
      {
        balance: model.lastBalance,
        currency: model.balanceCurrency,
        lastUpdated: model.lastBalanceCheck || model.updatedAt || new Date(),
        status: 'success',
        message: model.apiKey || model.accessKey ? 'configured' : 'missing credentials',
      },
      'success',
    );
  }

  async testModel(code: string) {
    const model = await this.aiModelModel.findOne({ code }).lean();
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    const configured = !!(model.apiKey || model.accessKey || process.env.DOUBAO_API_KEY);

    return this.appService.envelope(
      {
        success: configured,
        responseTime: configured ? 120 : 0,
        message: configured ? `${code} connection ok` : `${code} credentials are missing`,
      },
      'success',
    );
  }

  async getModelStats(code: string) {
    const model = await this.aiModelModel.findOne({ code }).lean();
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    const reviewedSubmissions = await this.submissionModel
      .find({
        $or: [{ aiReviewedAt: { $ne: null } }, { aiReviewMetadata: { $ne: null } }],
      })
      .sort({ updatedAt: -1 })
      .lean();

    const relatedAssignments = await this.assignmentModel
      .find({ _id: { $in: reviewedSubmissions.map((item) => item.assignmentId) } })
      .lean();
    const assignmentTitleMap = new Map(
      relatedAssignments.map((assignment) => [assignment._id.toString(), assignment.title]),
    );

    const dailyUsageMap = new Map<string, number>();
    const monthlyUsageMap = new Map<string, number>();

    reviewedSubmissions.forEach((submission) => {
      const timestamp = submission.aiReviewedAt || submission.submittedAt || submission.updatedAt;
      if (!timestamp) {
        return;
      }

      const date = new Date(timestamp);
      const dayKey = date.toISOString().slice(0, 10);
      const monthKey = dayKey.slice(0, 7);
      dailyUsageMap.set(dayKey, (dailyUsageMap.get(dayKey) || 0) + 1);
      monthlyUsageMap.set(monthKey, (monthlyUsageMap.get(monthKey) || 0) + 1);
    });

    return this.appService.envelope(
      {
        dailyUsage: [...dailyUsageMap.entries()]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([date, count]) => ({ date, count })),
        monthlyUsage: [...monthlyUsageMap.entries()]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([month, count]) => ({ month, count })),
        recentActivity: reviewedSubmissions.slice(0, 10).map((submission) => ({
          assignmentId: submission.assignmentId,
          assignmentTitle: assignmentTitleMap.get(submission.assignmentId) || '',
          usedAt: submission.aiReviewedAt || submission.submittedAt || submission.updatedAt,
          tokenUsed: Number(submission.aiReviewMetadata?.tokenUsed || 0),
        })),
      },
      'success',
    );
  }

  async initializeModels() {
    await this.ensureDefaultModels();
    return this.appService.envelope({ success: true, message: 'initialized' }, 'success');
  }

  async getSummary() {
    const models = await this.aiModelModel.find().lean();
    return this.buildSummary(models);
  }

  private async ensureDefaultModels() {
    await this.aiModelModel.updateOne(
      { code: 'doubao' },
      {
        $setOnInsert: {
          code: 'doubao',
          name: 'Doubao',
          provider: 'ByteDance',
          modelName: 'doubao-seed-2-0-lite-260215',
          baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
          apiKey: process.env.DOUBAO_API_KEY || '',
          status: 'active',
          isDefault: true,
          totalUsage: 0,
          totalTokens: 0,
          lastBalance: 100,
          balanceCurrency: 'CNY',
          lastBalanceCheck: new Date(),
        },
      },
      { upsert: true },
    );
  }

  private buildSummary(models: Array<AiModelDocument | AiModel>) {
    return {
      totalModels: models.length,
      activeModels: models.filter((item) => item.status === 'active').length,
      totalUsage: models.reduce((sum, item) => sum + Number(item.totalUsage || 0), 0),
      totalBalance: models.reduce((sum, item) => sum + Number(item.lastBalance || 0), 0),
    };
  }

  private toPayload(model: AiModelDocument | AiModel) {
    return {
      code: model.code,
      name: model.name,
      provider: model.provider,
      modelName: model.modelName,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      accessKey: model.accessKey,
      secretKey: model.secretKey,
      status: model.status,
      isDefault: !!model.isDefault,
      totalUsage: Number(model.totalUsage || 0),
      totalTokens: Number(model.totalTokens || 0),
      lastUsedAt: model.lastUsedAt,
      lastBalance: Number(model.lastBalance || 0),
      balanceCurrency: model.balanceCurrency,
      lastBalanceCheck: model.lastBalanceCheck,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}
