import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import {
  Assignment,
  AssignmentDocument,
} from '../assignments/schemas/assignment.schema';
import {
  Submission,
  SubmissionDocument,
} from '../submissions/schemas/submission.schema';
import { UpdateAiModelDto } from './dto/update-ai-model.dto';
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
        models: models.map((model) => this.toAdminPayload(model)),
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
    return this.appService.envelope(
      models.map((model) => this.toPublicPayload(model)),
      'success',
    );
  }

  async getModel(code: string) {
    const model = await this.aiModelModel.findOne({ code }).lean();
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    return this.appService.envelope(this.toAdminPayload(model), 'success');
  }

  async updateModel(code: string, body: UpdateAiModelDto) {
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
    if (body.lastBalance !== undefined)
      model.lastBalance = Number(body.lastBalance);
    if (body.balanceCurrency !== undefined)
      model.balanceCurrency = body.balanceCurrency;
    if (body.isDefault) {
      await this.aiModelModel.updateMany({}, { $set: { isDefault: false } });
      model.isDefault = true;
    }

    await model.save();
    return this.appService.envelope(this.toAdminPayload(model), 'success');
  }

  async setDefaultModel(code: string) {
    const model = await this.aiModelModel.findOne({ code });
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    await this.aiModelModel.updateMany({}, { $set: { isDefault: false } });
    model.isDefault = true;
    await model.save();

    return this.appService.envelope(
      { success: true, message: 'default updated' },
      'success',
    );
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
        message: this.hasCredentials(model)
          ? 'configured'
          : 'missing credentials',
      },
      'success',
    );
  }

  async testModel(code: string) {
    const model = await this.aiModelModel.findOne({ code }).lean();
    if (!model) {
      throw new NotFoundException('AI model not found');
    }

    if (!this.hasCredentials(model)) {
      return this.appService.envelope(
        {
          success: false,
          responseTime: 0,
          message: `${code} credentials are missing`,
        },
        'success',
      );
    }

    const startedAt = Date.now();
    const result = await this.probeModelConnection(model);

    return this.appService.envelope(
      {
        success: result.success,
        responseTime: Date.now() - startedAt,
        message: result.message,
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
        $or: [
          { aiReviewedAt: { $ne: null } },
          { aiReviewMetadata: { $ne: null } },
        ],
      })
      .sort({ updatedAt: -1 })
      .lean();
    const matchedSubmissions = reviewedSubmissions.filter((submission) =>
      this.matchesModel(submission, code),
    );

    const relatedAssignments = await this.assignmentModel
      .find({
        _id: { $in: matchedSubmissions.map((item) => item.assignmentId) },
      })
      .lean();
    const assignmentTitleMap = new Map(
      relatedAssignments.map((assignment) => [
        assignment._id.toString(),
        assignment.title,
      ]),
    );

    const dailyUsageMap = new Map<string, number>();
    const monthlyUsageMap = new Map<string, number>();

    matchedSubmissions.forEach((submission) => {
      const timestamp =
        submission.aiReviewedAt ||
        submission.submittedAt ||
        submission.updatedAt;
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
        recentActivity: matchedSubmissions.slice(0, 10).map((submission) => ({
          assignmentId: submission.assignmentId,
          assignmentTitle:
            assignmentTitleMap.get(submission.assignmentId) || '',
          usedAt:
            submission.aiReviewedAt ||
            submission.submittedAt ||
            submission.updatedAt,
          tokenUsed: this.resolveUsageTokens(submission),
        })),
      },
      'success',
    );
  }

  async initializeModels() {
    await this.ensureDefaultModels();
    return this.appService.envelope(
      { success: true, message: 'initialized' },
      'success',
    );
  }

  async getSummary() {
    const models = await this.aiModelModel.find().lean();
    return this.buildSummary(models);
  }

  async getDashboardStats() {
    const models = await this.aiModelModel.find().sort({ createdAt: 1 }).lean();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const reviewedSubmissions = await this.submissionModel
      .find({
        aiReviewedAt: { $ne: null },
      })
      .lean();

    const stats = models.reduce<Record<string, Record<string, unknown>>>(
      (result, model) => {
        const modelKey = model.code;
        const modelReviews = reviewedSubmissions.filter((item) =>
          this.matchesModel(item, modelKey),
        );

        const todayUsage = modelReviews.filter((item) => {
          const reviewedAt = item.aiReviewedAt
            ? new Date(item.aiReviewedAt)
            : null;
          return reviewedAt ? reviewedAt >= startOfToday : false;
        }).length;

        const totalUsage =
          Number(model.totalUsage || 0) > 0
            ? Number(model.totalUsage || 0)
            : modelReviews.length;
        const totalTokens =
          Number(model.totalTokens || 0) > 0
            ? Number(model.totalTokens || 0)
            : modelReviews.reduce(
                (sum, item) => sum + this.resolveUsageTokens(item),
                0,
              );

        const credentialsConfigured = this.hasCredentials(model);
        result[modelKey] = {
          isOnline: model.status === 'active' && credentialsConfigured,
          balance: Number(model.lastBalance || 0),
          totalUsage,
          totalTokens,
          todayUsage,
          lastBalanceCheck:
            model.lastBalanceCheck || model.updatedAt || model.createdAt,
        };
        return result;
      },
      {},
    );

    return this.appService.envelope(stats, 'success');
  }

  async recordReviewSuccess(payload: {
    provider: string;
    tokensUsed?: number;
    reviewedAt?: Date;
  }) {
    const reviewedAt = payload.reviewedAt || new Date();
    const tokensUsed = Number.isFinite(Number(payload.tokensUsed))
      ? Number(payload.tokensUsed)
      : 0;

    await this.aiModelModel.updateOne(
      { code: payload.provider },
      {
        $inc: {
          totalUsage: 1,
          totalTokens: tokensUsed,
        },
        $set: {
          lastUsedAt: reviewedAt,
        },
      },
    );
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
      totalUsage: models.reduce(
        (sum, item) => sum + Number(item.totalUsage || 0),
        0,
      ),
      totalBalance: models.reduce(
        (sum, item) => sum + Number(item.lastBalance || 0),
        0,
      ),
    };
  }

  private toPublicPayload(model: AiModelDocument | AiModel) {
    return {
      code: model.code,
      name: model.name,
      provider: model.provider,
      modelName: model.modelName,
      baseUrl: model.baseUrl,
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

  private toAdminPayload(model: AiModelDocument | AiModel) {
    return {
      ...this.toPublicPayload(model),
      apiKey: model.apiKey,
      accessKey: model.accessKey,
      secretKey: model.secretKey,
    };
  }

  private matchesModel(
    submission: SubmissionDocument | Submission,
    code: string,
  ) {
    const provider =
      this.readMetadataString(submission.aiReviewMetadata, 'provider') ||
      'doubao';
    const modelUsed =
      this.readMetadataString(submission.aiReviewMetadata, 'modelUsed') || '';
    return provider === code || modelUsed === code;
  }

  private resolveUsageTokens(submission: SubmissionDocument | Submission) {
    const usage = submission.aiReviewMetadata?.usage as
      | Record<string, unknown>
      | undefined;
    const totalTokensValue = Number(
      usage?.total_tokens ||
        usage?.totalTokens ||
        submission.aiReviewMetadata?.tokenUsed ||
        0,
    );
    return Number.isFinite(totalTokensValue) ? totalTokensValue : 0;
  }

  private readMetadataString(
    metadata: Submission['aiReviewMetadata'] | undefined,
    key: string,
  ) {
    const value = metadata?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  private async probeModelConnection(model: AiModelDocument | AiModel) {
    const apiKey = this.resolveApiKey(model);
    if (!apiKey) {
      return {
        success: false,
        message: `${model.code} credentials are missing`,
      };
    }

    const baseUrl = model.baseUrl.replace(/\/$/, '');

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelName,
          messages: [
            {
              role: 'user',
              content: 'Reply with OK.',
            },
          ],
          max_tokens: 8,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `${model.code} connection failed: ${response.status} ${errorText}`,
        };
      }

      return {
        success: true,
        message: `${model.code} connection ok`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown connection error';
      return {
        success: false,
        message: `${model.code} connection failed: ${message}`,
      };
    }
  }

  private hasCredentials(model: AiModelDocument | AiModel) {
    if (this.resolveApiKey(model) || model.accessKey || model.secretKey) {
      return true;
    }

    return false;
  }

  private resolveApiKey(model: AiModelDocument | AiModel) {
    if (model.apiKey) {
      return model.apiKey;
    }

    if (model.code === 'doubao' && process.env.DOUBAO_API_KEY) {
      return process.env.DOUBAO_API_KEY;
    }

    return '';
  }
}
