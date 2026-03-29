import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { TokenService } from '../auth/auth.helpers';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentStatusDto } from './dto/update-assignment-status.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly tokenService: TokenService,
    private readonly appService: AppService,
  ) {}

  async ensureSeedData() {
    const existing = await this.assignmentModel.countDocuments();
    if (existing > 0) {
      return;
    }

    const teacher = await this.userModel.findOne({ username: 'teacher1' });
    const classItem = await this.classModel.findOne({ _id: 'c-1' });

    if (!teacher || !classItem) {
      return;
    }

    await this.assignmentModel.create({
      _id: 'a-1',
      title: '英语阅读理解训练 1',
      description: '<p>请完成阅读理解并提交答案。</p>',
      teacherId: teacher.id,
      teacherName: teacher.name,
      classes: [{ id: classItem.id, name: classItem.name }],
      aiRule: {
        id: 'rule-1',
        name: '标准答题批改模板',
        modelType: 'doubao',
        prompt: '请根据题目、标准答案和学生答案进行评分，返回总分、问题、建议。',
        originalRuleId: 'rule-1',
        snapshotAt: new Date().toISOString(),
      },
      questionMaterial: {
        content: '<p>题目原文：请根据文章回答 5 个问题。</p>',
      },
      referenceAnswer: {
        content: '<p>标准答案：1.A 2.C 3.B 4.D 5.A</p>',
      },
      gradingNotes: '按题号逐项给分，错题说明原因。',
      submissionFormat: 'answers_only',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      allowAttachments: true,
      status: 'published',
    });
  }

  async listAssignments(query: AssignmentQueryDto) {
    await this.ensureSeedData();

    const filter: Record<string, unknown> = {};
    if (query.search) {
      filter.title = { $regex: query.search, $options: 'i' };
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.classId) {
      filter['classes.id'] = query.classId;
    }
    if (query.className) {
      filter['classes.name'] = { $regex: query.className, $options: 'i' };
    }
    if (query.teacherName) {
      filter.teacherName = { $regex: query.teacherName, $options: 'i' };
    }

    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const skip = (page - 1) * pageSize;

    const sortField = query.sort || 'createdAt';
    const sortOrder = query.order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.assignmentModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      this.assignmentModel.countDocuments(filter),
    ]);

    const itemsWithStats = await Promise.all(
      items.map(async (item) => {
        const totalStudents = await this.membershipModel.countDocuments({
          classId: { $in: item.classes.map((cls) => cls.id) },
        });

        return {
          ...this.toAssignmentListItem(item),
          submissionCount: 0,
          totalStudents,
          totalSubmissions: 0,
          gradedSubmissions: 0,
          reviewedSubmissions: 0,
          pendingSubmissions: 0,
        };
      }),
    );

    return this.appService.envelope(
      {
        items: itemsWithStats,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      '获取成功',
    );
  }

  async getAssignment(id: string) {
    await this.ensureSeedData();

    const item = await this.assignmentModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    const totalStudents = await this.membershipModel.countDocuments({
      classId: { $in: item.classes.map((cls) => cls.id) },
    });

    return this.appService.envelope(
      {
        ...this.toAssignmentDetail(item),
        totalStudents,
        submissionStats: {
          total: totalStudents,
          submitted: 0,
          graded: 0,
          pending: 0,
          totalSubmissions: 0,
          reviewedSubmissions: 0,
          pendingSubmissions: 0,
          draftSubmissions: 0,
        },
      },
      '获取成功',
    );
  }

  async getAssignmentStudents(id: string, query?: any) {
    await this.ensureSeedData();

    const assignment = await this.assignmentModel.findById(id).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    const filter: Record<string, unknown> = {
      classId: { $in: assignment.classes.map((cls) => cls.id) },
    };

    if (query?.classId) {
      filter.classId = query.classId;
    }
    if (query?.studentName) {
      filter.studentName = { $regex: query.studentName, $options: 'i' };
    }
    if (query?.studentNumber) {
      filter.studentNumber = { $regex: query.studentNumber, $options: 'i' };
    }
    if (query?.submissionStatus && query.submissionStatus !== 'not_submitted') {
      return this.appService.envelope(
        { items: [], total: 0, page: 1, limit: 20, totalPages: 1 },
        '获取成功',
      );
    }

    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 20);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.membershipModel.find(filter).skip(skip).limit(limit).lean(),
      this.membershipModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => ({
          _id: `virtual-${item.studentId}`,
          studentId: item.studentId,
          studentName: item.studentName,
          studentNumber: item.studentNumber,
          classId: item.classId,
          className:
            assignment.classes.find((cls) => cls.id === item.classId)?.name || '',
          status: 'not_submitted',
          contentPreview: '',
          wordCount: 0,
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      '获取成功',
    );
  }

  async createAssignment(authorization: string | undefined, payload: CreateAssignmentDto) {
    await this.ensureSeedData();
    const user = await this.getUserFromAuthorization(authorization);

    const classes = await this.classModel.find({ _id: { $in: payload.classes } }).lean();
    const classSnapshots = classes.map((item) => ({ id: item._id.toString(), name: item.name }));

    const item = await this.assignmentModel.create({
      title: payload.title,
      description: payload.description,
      teacherId: user.id,
      teacherName: user.name,
      classes: classSnapshots,
      aiRule: payload.aiRule || null,
      questionMaterial: payload.questionMaterial || null,
      referenceAnswer: payload.referenceAnswer || null,
      gradingNotes: payload.gradingNotes || '',
      submissionFormat: payload.submissionFormat || 'answers_only',
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      allowAttachments: !!payload.allowAttachments,
      status: 'draft',
    });

    return this.appService.envelope(this.toAssignmentDetail(item.toObject()), '创建成功');
  }

  async updateAssignment(id: string, payload: UpdateAssignmentDto) {
    await this.ensureSeedData();

    const item = await this.assignmentModel.findById(id);
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    if (payload.classes) {
      const classes = await this.classModel.find({ _id: { $in: payload.classes } }).lean();
      item.classes = classes.map((cls) => ({ id: cls._id.toString(), name: cls.name }));
    }

    if (payload.title !== undefined) item.title = payload.title;
    if (payload.description !== undefined) item.description = payload.description;
    if (payload.aiRule !== undefined) item.aiRule = payload.aiRule;
    if (payload.questionMaterial !== undefined) item.questionMaterial = payload.questionMaterial;
    if (payload.referenceAnswer !== undefined) item.referenceAnswer = payload.referenceAnswer;
    if (payload.gradingNotes !== undefined) item.gradingNotes = payload.gradingNotes;
    if (payload.submissionFormat !== undefined) item.submissionFormat = payload.submissionFormat;
    if (payload.startDate !== undefined) item.startDate = new Date(payload.startDate);
    if (payload.endDate !== undefined) item.endDate = new Date(payload.endDate);
    if (payload.allowAttachments !== undefined) item.allowAttachments = payload.allowAttachments;

    await item.save();
    return this.appService.envelope(this.toAssignmentDetail(item.toObject()), '更新成功');
  }

  async updateAssignmentStatus(id: string, payload: UpdateAssignmentStatusDto) {
    await this.ensureSeedData();

    const item = await this.assignmentModel.findById(id);
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    item.status = payload.status;
    item.terminatedReason = payload.terminatedReason;
    await item.save();

    return this.appService.envelope(this.toAssignmentDetail(item.toObject()), '更新成功');
  }

  async deleteAssignment(id: string) {
    await this.ensureSeedData();
    await this.assignmentModel.findByIdAndDelete(id);
    return this.appService.envelope(null, '删除成功');
  }

  async getStudentAssignments(authorization?: string, query?: AssignmentQueryDto) {
    await this.ensureSeedData();

    const user = await this.getUserFromAuthorization(authorization);
    const memberships = await this.membershipModel.find({ studentId: user.id }).lean();
    const classIds = memberships.map((item) => item.classId);

    const filter: Record<string, unknown> = {
      'classes.id': { $in: classIds },
    };

    const page = Number(query?.page || 1);
    const pageSize = Number(query?.pageSize || 10);
    const skip = (page - 1) * pageSize;

    const assignments = await this.assignmentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();
    const total = await this.assignmentModel.countDocuments(filter);

    let items = assignments.map((item) => {
      const matchedClass = item.classes.find((cls) => classIds.includes(cls.id));
      return {
        id: item._id.toString(),
        title: item.title,
        teacherName: item.teacherName,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        terminatedReason: item.terminatedReason,
        isExpired: new Date(item.endDate).getTime() < Date.now(),
        hasSubmitted: false,
        hasDraft: false,
        submissionStatus: undefined,
        submissionId: undefined,
        allowAttachments: !!item.allowAttachments,
        createdAt: item.createdAt,
        classId: matchedClass?.id || user.classId || '',
        className: matchedClass?.name || user.className || '',
      };
    });

    if (query?.businessStatus === 'todo') {
      items = items.filter((item) => !item.hasSubmitted && !item.isExpired);
    } else if (query?.businessStatus === 'completed') {
      items = items.filter((item) => item.hasSubmitted);
    } else if (query?.businessStatus === 'draft') {
      items = items.filter((item) => item.hasDraft);
    } else if (query?.businessStatus === 'expired') {
      items = items.filter((item) => item.isExpired);
    }

    return this.appService.envelope(
      {
        items,
        total: items.length,
        page,
        pageSize,
      },
      '获取成功',
    );
  }

  async getStudentAssignmentStatistics(authorization?: string) {
    const response = await this.getStudentAssignments(authorization, {
      page: 1,
      pageSize: 1000,
    });
    const items = response.data.items;

    return this.appService.envelope(
      {
        totalAssignments: items.length,
        submittedCount: items.filter((item: any) => item.hasSubmitted).length,
        todoCount: items.filter((item: any) => !item.hasSubmitted && !item.isExpired).length,
        draftCount: items.filter((item: any) => item.hasDraft).length,
        expiredCount: items.filter((item: any) => item.isExpired).length,
        reviewedCount: items.filter((item: any) => item.submissionStatus === 'teacher_reviewed').length,
      },
      '获取成功',
    );
  }

  async getStudentAssignment(
    authorization: string | undefined,
    assignmentId: string,
    classId?: string,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    const matchedClass = assignment.classes.find((cls) => cls.id === classId) || assignment.classes[0];

    return this.appService.envelope(
      {
        id: assignment._id.toString(),
        title: assignment.title,
        description: assignment.description,
        teacherName: assignment.teacherName,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        allowAttachments: !!assignment.allowAttachments,
        maxFileSize: 10,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
        status: assignment.status,
        terminatedReason: assignment.terminatedReason,
        isExpired: new Date(assignment.endDate).getTime() < Date.now(),
        hasSubmitted: false,
        hasDraft: false,
        submissionStatus: undefined,
        submissionId: undefined,
        canSubmit: assignment.status === 'published',
        createdAt: assignment.createdAt,
        classId: matchedClass?.id || user.classId,
        className: matchedClass?.name || user.className,
        aiRule: assignment.aiRule,
        questionMaterial: assignment.questionMaterial,
        referenceAnswer: assignment.referenceAnswer,
        gradingNotes: assignment.gradingNotes,
        submissionFormat: assignment.submissionFormat,
      },
      '获取成功',
    );
  }

  private async getUserFromAuthorization(authorization?: string) {
    const token = authorization?.replace('Bearer ', '').trim();
    if (!token) {
      throw new UnauthorizedException('未登录');
    }

    const decoded = this.tokenService.verifyAccessToken(token);
    const user = await this.userModel.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('登录失效');
    }

    return user;
  }

  private toAssignmentListItem(item: any) {
    return {
      id: item._id.toString(),
      title: item.title,
      description: item.description,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      classes: item.classes,
      aiRule: item.aiRule,
      startDate: item.startDate,
      endDate: item.endDate,
      allowAttachments: !!item.allowAttachments,
      status: item.status,
      terminatedReason: item.terminatedReason,
      isDeleted: false,
      deletedAt: undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isExpired: new Date(item.endDate).getTime() < Date.now(),
    };
  }

  private toAssignmentDetail(item: any) {
    return {
      ...this.toAssignmentListItem(item),
      submissionStats: {
        total: 0,
        submitted: 0,
        graded: 0,
        pending: 0,
      },
    };
  }
}
