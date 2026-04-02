import {
  BadRequestException,
  ForbiddenException,
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
import { Submission, SubmissionDocument } from '../submissions/schemas/submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentStatusDto } from './dto/update-assignment-status.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';

type NormalizedSubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'ai_reviewed'
  | 'teacher_reviewed'
  | 'ai_review_failed';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly tokenService: TokenService,
    private readonly appService: AppService,
  ) {}

  async listAssignments(authorization: string | undefined, query: AssignmentQueryDto) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const filter = this.buildTeacherAssignmentFilter(user, query);
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const skip = (page - 1) * pageSize;
    const sortField = query.sort || query.sortBy || 'createdAt';
    const sortOrder = (query.order || query.sortOrder) === 'asc' ? 1 : -1;

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
        const stats = await this.getAssignmentStats(item);
        return this.toAssignmentListItem(item, stats);
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

  async getAssignment(authorization: string | undefined, id: string) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const item = await this.assignmentModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    this.assertCanManageAssignment(user, item.teacherId);
    const stats = await this.getAssignmentStats(item);

    return this.appService.envelope(this.toAssignmentDetail(item, stats), '获取成功');
  }

  async getAssignmentStudents(
    authorization: string | undefined,
    id: string,
    query?: Record<string, any>,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const assignment = await this.assignmentModel.findById(id).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    this.assertCanManageAssignment(user, assignment.teacherId);

    const assignmentClassIds = assignment.classes.map((item) => item.id);
    const selectedClassIds =
      query?.classId && assignmentClassIds.includes(query.classId)
        ? [query.classId]
        : assignmentClassIds;

    const membershipFilter: Record<string, unknown> = {
      classId: { $in: selectedClassIds },
      status: 'active',
    };

    if (query?.studentName) {
      membershipFilter.studentName = { $regex: query.studentName, $options: 'i' };
    }
    if (query?.studentNumber) {
      membershipFilter.studentNumber = { $regex: query.studentNumber, $options: 'i' };
    }

    const memberships = await this.membershipModel.find(membershipFilter).lean();
    const studentIds = memberships.map((item) => item.studentId);
    const submissions = studentIds.length
      ? await this.submissionModel
          .find({
            assignmentId: id,
            studentId: { $in: studentIds },
            classId: { $in: selectedClassIds },
          })
          .lean()
      : [];

    const submissionMap = new Map(submissions.map((item) => [item.studentId, item]));
    let rows = memberships.map((member) => {
      const submission = submissionMap.get(member.studentId);
      const normalizedStatus = submission
        ? this.normalizeSubmissionStatus(submission.status)
        : 'not_submitted';

      return {
        _id: submission?._id?.toString?.() || `virtual-${member.studentId}`,
        studentId: member.studentId,
        studentName: member.studentName,
        studentNumber: member.studentNumber || '',
        classId: member.classId,
        className:
          assignment.classes.find((item) => item.id === member.classId)?.name || '',
        status: normalizedStatus,
        submittedAt: submission?.submittedAt || null,
        content: submission?.content || '',
        contentPreview: submission?.content ? this.getContentPreview(submission.content) : '',
        wordCount: submission?.content ? this.getWordCount(submission.content) : 0,
        aiScore: submission?.aiScore ?? null,
        teacherScore: submission?.teacherScore ?? null,
        teacherReviewedAt: submission?.teacherReviewedAt || null,
        teacherName: submission ? assignment.teacherName : '',
      };
    });

    rows = rows.filter((row) => {
      const hasSubmission = row.status !== 'not_submitted';
      const isDraft = row.status === 'draft';

      if (query?.submissionStatus === 'submitted' && (!hasSubmission || isDraft)) {
        return false;
      }
      if (query?.submissionStatus === 'draft' && !isDraft) {
        return false;
      }
      if (query?.submissionStatus === 'not_submitted' && hasSubmission) {
        return false;
      }
      if (query?.gradingStatus && row.status !== query.gradingStatus) {
        return false;
      }
      return true;
    });

    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 20);
    const total = rows.length;
    const pagedRows = rows.slice((page - 1) * limit, page * limit);

    return this.appService.envelope(
      {
        items: pagedRows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      '获取成功',
    );
  }

  async createAssignment(authorization: string | undefined, payload: CreateAssignmentDto) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const classes = await this.resolveAssignmentClasses(user, payload.classes);
    const item = await this.assignmentModel.create({
      title: payload.title,
      description: payload.description,
      teacherId: user.id,
      teacherName: user.name,
      classes,
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

    const stats = await this.getAssignmentStats(item.toObject());
    return this.appService.envelope(this.toAssignmentDetail(item.toObject(), stats), '创建成功');
  }

  async updateAssignment(
    authorization: string | undefined,
    id: string,
    payload: UpdateAssignmentDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const item = await this.assignmentModel.findById(id);
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    this.assertCanManageAssignment(user, item.teacherId);

    if (payload.classes) {
      item.classes = await this.resolveAssignmentClasses(user, payload.classes);
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
    const stats = await this.getAssignmentStats(item.toObject());
    return this.appService.envelope(this.toAssignmentDetail(item.toObject(), stats), '更新成功');
  }

  async updateAssignmentStatus(
    authorization: string | undefined,
    id: string,
    payload: UpdateAssignmentStatusDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const item = await this.assignmentModel.findById(id);
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    this.assertCanManageAssignment(user, item.teacherId);
    item.status = payload.status;
    item.terminatedReason =
      payload.status === 'terminated' ? payload.terminatedReason : undefined;
    await item.save();

    const stats = await this.getAssignmentStats(item.toObject());
    return this.appService.envelope(this.toAssignmentDetail(item.toObject(), stats), '更新成功');
  }

  async deleteAssignment(authorization: string | undefined, id: string) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const item = await this.assignmentModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('作业不存在');
    }

    this.assertCanManageAssignment(user, item.teacherId);

    await Promise.all([
      this.assignmentModel.findByIdAndDelete(id),
      this.submissionModel.deleteMany({ assignmentId: id }),
    ]);

    return this.appService.envelope(null, '删除成功');
  }

  async getStudentAssignments(
    authorization: string | undefined,
    query?: AssignmentQueryDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    if (user.role !== 'student') {
      throw new ForbiddenException('只有学生可以查看学生端作业');
    }

    const memberships = await this.membershipModel
      .find({ studentId: user.id, status: 'active' })
      .lean();
    const classIds = memberships.map((item) => item.classId);

    if (!classIds.length) {
      return this.appService.envelope(
        {
          items: [],
          total: 0,
          page: Number(query?.page || 1),
          pageSize: Number(query?.pageSize || 10),
        },
        '获取成功',
      );
    }

    const filter = this.buildStudentAssignmentFilter(classIds, query);
    const sortField = query?.sort || query?.sortBy || 'createdAt';
    const sortOrder = (query?.order || query?.sortOrder) === 'asc' ? 1 : -1;
    const assignments = await this.assignmentModel
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .lean();
    const submissions = await this.submissionModel
      .find({
        assignmentId: { $in: assignments.map((item) => item._id.toString()) },
        studentId: user.id,
      })
      .lean();
    const submissionMap = new Map(submissions.map((item) => [item.assignmentId, item]));

    let items = assignments.map((item) => {
      const availableClasses = item.classes.filter((cls) => classIds.includes(cls.id));
      const matchedClass = availableClasses[0];
      const submission = submissionMap.get(item._id.toString());
      const normalizedStatus = submission
        ? this.normalizeSubmissionStatus(submission.status)
        : undefined;
      const hasSubmitted = !!submission && !submission.isDraft;
      const hasDraft = !!submission && submission.isDraft;

      return {
        id: item._id.toString(),
        title: item.title,
        teacherName: item.teacherName,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        terminatedReason: item.terminatedReason,
        isExpired: this.isExpired(item.endDate),
        hasSubmitted,
        hasDraft,
        submissionStatus: normalizedStatus,
        submissionId: submission?._id?.toString?.(),
        allowAttachments: !!item.allowAttachments,
        createdAt: item.createdAt,
        classId: matchedClass?.id || user.classId || '',
        className: matchedClass?.name || user.className || '',
      };
    });

    items = items.filter((item) => {
      if (query?.businessStatus === 'todo') {
        return item.status === 'published' && !item.isExpired && !item.hasSubmitted;
      }
      if (query?.businessStatus === 'completed') {
        return item.hasSubmitted;
      }
      if (query?.businessStatus === 'draft') {
        return item.hasDraft;
      }
      if (query?.businessStatus === 'expired') {
        return item.isExpired;
      }
      return true;
    });

    const page = Number(query?.page || 1);
    const pageSize = Number(query?.pageSize || 10);
    const total = items.length;
    items = items.slice((page - 1) * pageSize, page * pageSize);

    return this.appService.envelope(
      {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
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
        todoCount: items.filter(
          (item: any) => item.status === 'published' && !item.isExpired && !item.hasSubmitted,
        ).length,
        draftCount: items.filter((item: any) => item.hasDraft).length,
        expiredCount: items.filter((item: any) => item.isExpired).length,
        reviewedCount: items.filter((item: any) => item.submissionStatus === 'teacher_reviewed')
          .length,
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
    if (user.role !== 'student') {
      throw new ForbiddenException('只有学生可以查看学生端作业');
    }

    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status === 'draft') {
      throw new ForbiddenException('草稿作业暂不可查看');
    }

    const memberships = await this.membershipModel
      .find({
        studentId: user.id,
        classId: { $in: assignment.classes.map((item) => item.id) },
        status: 'active',
      })
      .lean();

    if (!memberships.length) {
      throw new ForbiddenException('你不在当前作业所属班级中');
    }

    const availableClassIds = memberships.map((item) => item.classId);
    if (classId && !availableClassIds.includes(classId)) {
      throw new ForbiddenException('你不在指定班级中');
    }
    const resolvedClassId =
      classId && availableClassIds.includes(classId) ? classId : availableClassIds[0];
    const matchedClass = assignment.classes.find((item) => item.id === resolvedClassId);

    const submission = await this.submissionModel.findOne({ assignmentId, studentId: user.id }).lean();
    const normalizedStatus = submission
      ? this.normalizeSubmissionStatus(submission.status)
      : undefined;
    const hasSubmitted = !!submission && !submission.isDraft;
    const hasDraft = !!submission && submission.isDraft;
    const isExpired = this.isExpired(assignment.endDate);
    const canSubmit =
      assignment.status === 'published' &&
      !isExpired &&
      (!submission ||
        submission.isDraft ||
        (submission.status !== 'teacher_reviewed' && (submission.submissionCount || 0) < 2));

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
        isExpired,
        hasSubmitted,
        hasDraft,
        submissionStatus: normalizedStatus,
        submissionId: submission?._id?.toString?.(),
        canSubmit,
        createdAt: assignment.createdAt,
        classId: matchedClass?.id || resolvedClassId,
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

  private buildTeacherAssignmentFilter(user: UserDocument, query: AssignmentQueryDto) {
    const filter: Record<string, unknown> = {};
    const keyword = query.search || query.title;

    if (user.role !== 'superadmin') {
      filter.teacherId = user.id;
    }
    if (keyword) {
      filter.title = { $regex: keyword, $options: 'i' };
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
    if (query.startDate) {
      filter.startDate = {
        ...(filter.startDate as Record<string, Date>),
        $gte: new Date(query.startDate),
      };
    }
    if (query.endDate) {
      filter.endDate = {
        ...(filter.endDate as Record<string, Date>),
        $lte: new Date(query.endDate),
      };
    }
    if (query.isExpired === true) {
      filter.endDate = { ...(filter.endDate as Record<string, Date>), $lt: new Date() };
    } else if (query.isExpired === false) {
      filter.endDate = { ...(filter.endDate as Record<string, Date>), $gte: new Date() };
    }

    return filter;
  }

  private buildStudentAssignmentFilter(classIds: string[], query?: AssignmentQueryDto) {
    const keyword = query?.search || query?.title;
    const filter: Record<string, unknown> = {
      'classes.id': { $in: classIds },
      status: query?.status || { $in: ['published', 'terminated'] },
    };

    if (keyword) {
      filter.title = { $regex: keyword, $options: 'i' };
    }
    if (query?.classId) {
      filter['classes.id'] = query.classId;
    }
    if (query?.className) {
      filter['classes.name'] = { $regex: query.className, $options: 'i' };
    }
    if (query?.teacherName) {
      filter.teacherName = { $regex: query.teacherName, $options: 'i' };
    }
    if (query?.startDate) {
      filter.startDate = {
        ...(filter.startDate as Record<string, Date>),
        $gte: new Date(query.startDate),
      };
    }
    if (query?.endDate) {
      filter.endDate = {
        ...(filter.endDate as Record<string, Date>),
        $lte: new Date(query.endDate),
      };
    }
    if (query?.isExpired === true) {
      filter.endDate = { ...(filter.endDate as Record<string, Date>), $lt: new Date() };
    } else if (query?.isExpired === false) {
      filter.endDate = { ...(filter.endDate as Record<string, Date>), $gte: new Date() };
    }

    return filter;
  }

  private async resolveAssignmentClasses(user: UserDocument, classIds: string[]) {
    const uniqueClassIds = [...new Set(classIds || [])];
    if (!uniqueClassIds.length) {
      throw new BadRequestException('请至少选择一个班级');
    }

    const classes = await this.classModel.find({ _id: { $in: uniqueClassIds } }).lean();
    if (classes.length !== uniqueClassIds.length) {
      throw new BadRequestException('存在无效的班级');
    }

    if (user.role !== 'superadmin') {
      const invalidClass = classes.find((item) => item.teacherId !== user.id);
      if (invalidClass) {
        throw new ForbiddenException('只能给自己的班级布置作业');
      }
    }

    return classes.map((item) => ({ id: item._id.toString(), name: item.name }));
  }

  private async getAssignmentStats(item: any) {
    const classIds = (item.classes || []).map((cls: { id: string }) => cls.id);
    if (!classIds.length) {
      return {
        total: 0,
        submitted: 0,
        graded: 0,
        pending: 0,
        totalStudents: 0,
        totalSubmissions: 0,
        reviewedSubmissions: 0,
        pendingSubmissions: 0,
        draftSubmissions: 0,
      };
    }

    const [studentIds, submissions] = await Promise.all([
      this.membershipModel.distinct('studentId', {
        classId: { $in: classIds },
        status: 'active',
      }),
      this.submissionModel.find({ assignmentId: item._id?.toString?.() || item.id }).lean(),
    ]);

    const nonDraftSubmissions = submissions.filter((submission) => !submission.isDraft);
    const teacherReviewedSubmissions = nonDraftSubmissions.filter(
      (submission) => submission.status === 'teacher_reviewed',
    );
    const aiProcessedSubmissions = nonDraftSubmissions.filter(
      (submission) =>
        submission.status === 'ai_reviewed' ||
        submission.status === 'teacher_reviewed' ||
        submission.aiScore !== null,
    );
    const pendingTeacherReviewSubmissions = nonDraftSubmissions.filter(
      (submission) => this.normalizeSubmissionStatus(submission.status) === 'submitted',
    );
    const draftSubmissions = submissions.filter((submission) => submission.isDraft).length;

    return {
      total: studentIds.length,
      submitted: nonDraftSubmissions.length,
      graded: aiProcessedSubmissions.length,
      pending: pendingTeacherReviewSubmissions.length,
      totalStudents: studentIds.length,
      totalSubmissions: nonDraftSubmissions.length,
      reviewedSubmissions: teacherReviewedSubmissions.length,
      pendingSubmissions: pendingTeacherReviewSubmissions.length,
      draftSubmissions,
    };
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

    this.assertTokenFreshForUser(user, decoded.iat);
    return user;
  }

  private assertTeacherPrivileges(user: UserDocument) {
    if (!['teacher', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('当前用户无权执行教师端操作');
    }
  }

  private assertCanManageAssignment(user: UserDocument, teacherId: string) {
    this.assertTeacherPrivileges(user);
    if (user.role !== 'superadmin' && user.id !== teacherId) {
      throw new ForbiddenException('只能管理自己的作业');
    }
  }

  private normalizeSubmissionStatus(status: string): NormalizedSubmissionStatus {
    if (status === 'ai_review_queued' || status === 'ai_review_failed') {
      return 'submitted';
    }
    return status as NormalizedSubmissionStatus;
  }

  private assertTokenFreshForUser(user: UserDocument, issuedAt?: number) {
    const issuedAtDate = issuedAt ? new Date(issuedAt * 1000) : null;
    if (
      issuedAtDate &&
      user.lastLogoutAt &&
      user.lastLogoutAt.getTime() > issuedAtDate.getTime()
    ) {
      throw new UnauthorizedException('登录已失效');
    }
    if (
      issuedAtDate &&
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() > issuedAtDate.getTime()
    ) {
      throw new UnauthorizedException('登录已失效');
    }
  }

  private isExpired(endDate: string | Date) {
    return new Date(endDate).getTime() < Date.now();
  }

  private getWordCount(content: string) {
    return content.replace(/\s/g, '').length;
  }

  private getContentPreview(content: string) {
    return content.length > 50 ? `${content.slice(0, 50)}...` : content;
  }

  private toAssignmentListItem(item: any, stats: any) {
    return {
      id: item._id?.toString?.() || item.id,
      title: item.title,
      description: item.description,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      classes: item.classes,
      aiRule: item.aiRule,
      questionMaterial: item.questionMaterial,
      referenceAnswer: item.referenceAnswer,
      gradingNotes: item.gradingNotes,
      submissionFormat: item.submissionFormat,
      startDate: item.startDate,
      endDate: item.endDate,
      allowAttachments: !!item.allowAttachments,
      status: item.status,
      terminatedReason: item.terminatedReason,
      isDeleted: false,
      deletedAt: undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isExpired: this.isExpired(item.endDate),
      submissionStats: {
        total: stats.total,
        submitted: stats.submitted,
        graded: stats.graded,
        pending: stats.pending,
      },
      submissionCount: stats.totalSubmissions,
      totalStudents: stats.totalStudents,
      totalSubmissions: stats.totalSubmissions,
      gradedSubmissions: stats.graded,
      reviewedSubmissions: stats.reviewedSubmissions,
      pendingSubmissions: stats.pendingSubmissions,
    };
  }

  private toAssignmentDetail(item: any, stats: any) {
    return {
      ...this.toAssignmentListItem(item, stats),
      totalStudents: stats.totalStudents,
      submissionStats: {
        total: stats.total,
        submitted: stats.submitted,
        graded: stats.graded,
        pending: stats.pending,
        totalSubmissions: stats.totalSubmissions,
        reviewedSubmissions: stats.reviewedSubmissions,
        pendingSubmissions: stats.pendingSubmissions,
        draftSubmissions: stats.draftSubmissions,
      },
    };
  }
}
