import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { Assignment, AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { Submission, SubmissionDocument } from '../submissions/schemas/submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AiModelsService } from './ai-models.service';

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
        this.userModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        this.classModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        this.submissionModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
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
        classStatusDistribution: this.toStatusDistribution(classesByStatus, totalClasses),
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

  getHealth() {
    const dbReadyState = this.userModel.db.readyState;
    const db = dbReadyState === 1 ? 'ok' : 'error';

    return this.appService.envelope(
      {
        db,
        redis: process.env.REDIS_URL ? 'configured' : 'disabled',
        ai: process.env.DOUBAO_API_KEY ? 'configured' : 'not_configured',
      },
      'success',
    );
  }

  async getAiModelStats() {
    return this.aiModelsService.getDashboardStats();
  }

  private toRoleDistribution(items: Array<{ _id: string; count: number }>, total: number) {
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

  private toStatusDistribution(
    items: Array<{ _id: string; count: number }>,
    total: number,
  ) {
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
}
