import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import {
  Assignment,
  AssignmentDocument,
} from '../assignments/schemas/assignment.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import {
  Submission,
  SubmissionDocument,
} from '../submissions/schemas/submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AiModelsService } from './ai-models.service';

type CountAggregateItem = {
  _id: string;
  count: number;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly aiModelsService: AiModelsService,
    private readonly appService: AppService,
  ) {}

  async getOverview() {
    const [totalUsers, totalClasses, totalAssignments, totalSubmissions] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.classModel.countDocuments(),
        this.assignmentModel.countDocuments(),
        this.submissionModel.countDocuments(),
      ]);

    const [usersByRole, classesByStatus, submissionsByStatus, aiModels] =
      await Promise.all([
        this.userModel.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]) as Promise<CountAggregateItem[]>,
        this.classModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]) as Promise<CountAggregateItem[]>,
        this.submissionModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]) as Promise<CountAggregateItem[]>,
        this.aiModelsService.getSummary(),
      ]);

    return this.appService.envelope(
      {
        totalUsers,
        totalClasses,
        totalAssignments,
        totalSubmissions,
        aiModelCount: aiModels.totalModels,
        userRoleDistribution: this.toRoleDistribution(usersByRole, totalUsers),
        classStatusDistribution: this.toStatusDistribution(
          classesByStatus,
          totalClasses,
        ),
        submissionStatusDistribution: this.toStatusDistribution(
          submissionsByStatus,
          totalSubmissions,
        ),
        lastUpdated: new Date().toISOString(),
      },
      'success',
    );
  }

  async getRecentUsers(limit = 10) {
    const items = await this.userModel
      .find()
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 10, 50)))
      .lean();

    return this.appService.envelope(
      {
        users: items.map((item) => ({
          id: item._id.toString(),
          name: item.name,
          role: this.toRoleCode(item.role),
          email: item.email,
          createdAt: item.createdAt,
          status: item.status,
        })),
      },
      'success',
    );
  }

  async getHealth() {
    const checkedAt = new Date().toISOString();
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();
    const aiConfigured = !!process.env.DOUBAO_API_KEY;

    return this.appService.envelope(
      {
        db: dbStatus.status,
        redis: redisStatus.status,
        ai: aiConfigured ? 'configured' : 'not_configured',
        checkedAt,
        details: {
          db: dbStatus,
          redis: redisStatus,
          ai: {
            provider: 'doubao',
            configured: aiConfigured,
          },
        },
      },
      'success',
    );
  }

  async getAiModelStats() {
    return this.aiModelsService.getDashboardStats();
  }

  private toRoleDistribution(items: CountAggregateItem[], total: number) {
    const order = ['superadmin', 'teacher', 'student'];
    return order.map((role) => {
      const found = items.find((item) => item._id === role);
      const count = found?.count || 0;
      return {
        role: this.toRoleCode(role),
        count,
        percentage: total ? Math.round((count / total) * 100) : 0,
      };
    });
  }

  private toStatusDistribution(items: CountAggregateItem[], total: number) {
    return items.map((item) => ({
      status: item._id,
      count: item.count,
      percentage: total ? Math.round((item.count / total) * 100) : 0,
    }));
  }

  private toRoleCode(role: string) {
    if (role === 'superadmin') return 'SUPER_ADMIN';
    if (role === 'teacher') return 'TEACHER';
    return 'STUDENT';
  }

  private async checkDatabase() {
    const dbReadyState = Number(this.userModel.db.readyState);
    const detail = {
      status: dbReadyState === 1 ? 'ok' : 'error',
      readyState: dbReadyState,
      databaseName: this.userModel.db.name,
    };

    if (dbReadyState !== 1 || !this.userModel.db.db) {
      return detail;
    }

    try {
      await this.userModel.db.db.admin().ping();
      return detail;
    } catch (error: unknown) {
      return {
        ...detail,
        status: 'error',
        error: error instanceof Error ? error.message : 'database ping failed',
      };
    }
  }

  private async checkRedis() {
    if (!process.env.REDIS_URL) {
      return {
        status: 'disabled',
        configured: false,
      };
    }

    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    try {
      const pingResponse = await Promise.race([
        client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('redis ping timeout')), 2000),
        ),
      ]);
      const isConnected = pingResponse === 'PONG';

      return {
        status: isConnected ? 'ok' : 'error',
        configured: true,
      };
    } catch (error: unknown) {
      return {
        status: 'error',
        configured: true,
        error: error instanceof Error ? error.message : 'redis ping failed',
      };
    } finally {
      client.disconnect();
    }
  }
}
