import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { AiRule, AiRuleDocument } from './schemas/ai-rule.schema';

@Injectable()
export class AiRulesService {
  constructor(
    @InjectModel(AiRule.name)
    private readonly aiRuleModel: Model<AiRuleDocument>,
    private readonly appService: AppService,
  ) {}

  async getAiRuleList(currentUser: AuthenticatedUser, query: any) {
    const filter: Record<string, unknown> = {};
    if (query?.status) filter.status = query.status;
    if (query?.visibility) filter.visibility = query.visibility;
    if (query?.modelType) filter.modelType = query.modelType;
    if (query?.search) {
      const keyword = String(query.search).trim();
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $elemMatch: { $regex: keyword, $options: 'i' } } },
      ];
    }
    if (query?.tags?.length) {
      const tags = Array.isArray(query.tags) ? query.tags : [query.tags];
      filter.tags = { $in: tags };
    }

    const visibilityFilter =
      currentUser.role === 'superadmin'
        ? {}
        : {
            $or: [
              { visibility: { $in: ['public', 'system'] } },
              { createdById: currentUser.id },
            ],
          };

    const page = Number(query?.page || 1);
    const pageSize = Number(query?.pageSize || 10);
    const sortField = query?.sort || 'createdAt';
    const sortOrder = query?.order === 'asc' ? 1 : -1;
    const skip = (page - 1) * pageSize;

    const mongoFilter = { ...filter, ...visibilityFilter };

    const [items, total] = await Promise.all([
      this.aiRuleModel
        .find(mongoFilter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      this.aiRuleModel.countDocuments(mongoFilter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toPayload(item)),
        total,
        page,
        pageSize,
      },
      'success',
    );
  }

  async getAvailableAiRules(currentUser: AuthenticatedUser, status = 'active') {
    const filter =
      currentUser.role === 'superadmin'
        ? { status }
        : {
            status,
            $or: [
              { visibility: { $in: ['public', 'system'] } },
              { createdById: currentUser.id },
            ],
          };

    const items = await this.aiRuleModel.find(filter).sort({ createdAt: -1 }).lean();
    return this.appService.envelope(items.map((item) => this.toPayload(item)), 'success');
  }

  async getAiRule(currentUser: AuthenticatedUser, id: string) {
    const item = await this.aiRuleModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('AI rule not found');
    }

    this.assertCanView(currentUser, item);
    return this.appService.envelope(this.toPayload(item), 'success');
  }

  async createAiRule(currentUser: AuthenticatedUser, body: any) {
    if (!body?.name || !body?.prompt) {
      throw new BadRequestException('Rule name and prompt are required');
    }

    const created = await this.aiRuleModel.create({
      _id: `rule-${Date.now()}`,
      name: body.name,
      description: body.description || '',
      modelType: body.modelType || 'doubao',
      prompt: body.prompt,
      visibility:
        currentUser.role === 'superadmin' && body.visibility === 'system'
          ? 'system'
          : body.visibility || 'private',
      status: body.status || 'active',
      tags: Array.isArray(body.tags) ? body.tags : [],
      createdById: currentUser.id,
      createdByName: currentUser.name,
    });

    return this.appService.envelope({ id: created._id, success: true }, 'success');
  }

  async updateAiRule(currentUser: AuthenticatedUser, id: string, body: any) {
    const item = await this.aiRuleModel.findById(id);
    if (!item) {
      throw new NotFoundException('AI rule not found');
    }
    this.assertCanManage(currentUser, item);

    if (body.name !== undefined) item.name = body.name;
    if (body.description !== undefined) item.description = body.description;
    if (body.modelType !== undefined) item.modelType = body.modelType;
    if (body.prompt !== undefined) item.prompt = body.prompt;
    if (body.visibility !== undefined) {
      item.visibility =
        currentUser.role === 'superadmin' && body.visibility === 'system'
          ? 'system'
          : body.visibility;
    }
    if (body.status !== undefined) item.status = body.status;
    if (body.tags !== undefined) item.tags = Array.isArray(body.tags) ? body.tags : [];

    await item.save();
    return this.appService.envelope({ id, success: true }, 'success');
  }

  async deleteAiRule(currentUser: AuthenticatedUser, id: string) {
    const item = await this.aiRuleModel.findById(id);
    if (!item) {
      throw new NotFoundException('AI rule not found');
    }
    this.assertCanManage(currentUser, item);

    await this.aiRuleModel.deleteOne({ _id: id });
    return this.appService.envelope({ id, success: true }, 'success');
  }

  async copyAiRule(currentUser: AuthenticatedUser, id: string, body: any) {
    const item = await this.aiRuleModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('AI rule not found');
    }
    this.assertCanView(currentUser, item);

    const copy = await this.aiRuleModel.create({
      _id: `rule-${Date.now()}`,
      name: body?.name || `${item.name} Copy`,
      description: item.description,
      modelType: item.modelType,
      prompt: item.prompt,
      visibility: 'private',
      status: 'active',
      tags: item.tags || [],
      createdById: currentUser.id,
      createdByName: currentUser.name,
    });

    return this.appService.envelope({ id: copy._id, success: true }, 'success');
  }

  private assertCanView(
    currentUser: AuthenticatedUser,
    item: AiRuleDocument | (AiRule & { _id: string }),
  ) {
    if (
      currentUser.role !== 'superadmin' &&
      item.visibility === 'private' &&
      item.createdById !== currentUser.id
    ) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private assertCanManage(
    currentUser: AuthenticatedUser,
    item: AiRuleDocument | (AiRule & { _id: string }),
  ) {
    if (currentUser.role === 'superadmin') {
      return;
    }

    if (item.createdById !== currentUser.id) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private toPayload(item: AiRuleDocument | (AiRule & { _id: string })) {
    return {
      id: item._id,
      name: item.name,
      description: item.description || '',
      modelType: item.modelType,
      prompt: item.prompt,
      status: item.status,
      visibility: item.visibility,
      tags: item.tags || [],
      createdBy: item.createdById
        ? {
            id: item.createdById,
            name: item.createdByName || 'Unknown',
          }
        : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
