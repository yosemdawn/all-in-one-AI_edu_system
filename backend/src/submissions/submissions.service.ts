import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { TokenService } from '../auth/auth.helpers';
import { Assignment, AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AiReviewQueueService } from './ai-review-queue.service';
import { DeleteSubmissionDto } from './dto/delete-submission.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { TeacherReviewDto } from './dto/teacher-review.dto';
import { Submission, SubmissionDocument } from './schemas/submission.schema';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
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
    @Optional()
    private readonly aiReviewQueueService?: AiReviewQueueService,
  ) {}

  async submit(authorization: string | undefined, payload: SubmitAssignmentDto) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertRoles(user, ['student']);

    const assignment = await this.assignmentModel.findById(payload.assignmentId);
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (assignment.status !== 'published') {
      throw new BadRequestException('当前作业不可提交');
    }
    if (new Date(assignment.endDate).getTime() < Date.now()) {
      throw new BadRequestException('作业已截止，无法继续提交');
    }

    const allowedClassIds = assignment.classes.map((item) => item.id);
    const targetClassId = payload.classId || user.classId;
    if (!targetClassId || !allowedClassIds.includes(targetClassId)) {
      throw new BadRequestException('提交班级与作业班级不匹配');
    }

    const classItem = await this.classModel.findById(targetClassId).lean();
    if (!classItem || classItem.status !== 'active') {
      throw new BadRequestException('当前班级不可提交作业');
    }

    const member = await this.membershipModel.findOne({
      classId: targetClassId,
      studentId: user.id,
      status: 'active',
    });
    if (!member) {
      throw new BadRequestException('当前学生不在该班级中，无法提交此作业');
    }

    const className =
      assignment.classes.find((item) => item.id === targetClassId)?.name || user.className || '';

    let existing = await this.submissionModel.findOne({
      assignmentId: payload.assignmentId,
      studentId: user.id,
    });

    if (existing) {
      const previousSubmittedCount = existing.isDraft ? 0 : existing.submissionCount || 0;
      if (!payload.isDraft && existing.status === 'teacher_reviewed') {
        throw new BadRequestException('作业已被教师批改，不能再次提交');
      }
      if (!payload.isDraft && previousSubmittedCount >= 2) {
        throw new BadRequestException('已达到最大提交次数，不能再次提交');
      }

      existing.classId = targetClassId;
      existing.className = className;
      existing.content = payload.content;
      existing.attachments = payload.attachments || [];
      existing.isDraft = !!payload.isDraft;
      existing.status = payload.isDraft ? 'draft' : 'submitted';
      existing.submittedAt = payload.isDraft ? existing.submittedAt : new Date();
      existing.aiScore = null;
      existing.aiReviewContent = null;
      existing.aiReviewMetadata = null;
      existing.aiReviewedAt = null;
      existing.teacherScore = null;
      existing.teacherReviewContent = null;
      existing.teacherReviewedAt = null;
      existing.submissionCount = payload.isDraft
        ? previousSubmittedCount
        : previousSubmittedCount + 1;
      await existing.save();

      if (!payload.isDraft) {
        await this.markAiReviewQueued(existing);
      }

      return this.appService.envelope(
        this.toSubmissionPayload(existing),
        payload.isDraft ? '草稿保存成功' : '提交成功',
      );
    }

    existing = await this.submissionModel.create({
      assignmentId: payload.assignmentId,
      studentId: user.id,
      studentName: user.name,
      studentNumber: user.studentId,
      classId: targetClassId,
      className,
      content: payload.content,
      attachments: payload.attachments || [],
      status: payload.isDraft ? 'draft' : 'submitted',
      isDraft: !!payload.isDraft,
      submittedAt: payload.isDraft ? null : new Date(),
      submissionCount: payload.isDraft ? 0 : 1,
      aiScore: null,
      aiReviewContent: null,
      aiReviewMetadata: null,
      aiReviewedAt: null,
      teacherScore: null,
      teacherReviewContent: null,
      teacherReviewedAt: null,
    });

    if (!payload.isDraft) {
      await this.markAiReviewQueued(existing);
    }

    return this.appService.envelope(
      this.toSubmissionPayload(existing),
      payload.isDraft ? '草稿保存成功' : '提交成功',
    );
  }

  async getMySubmission(authorization: string | undefined, assignmentId: string) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertRoles(user, ['student']);

    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    const submission = await this.submissionModel
      .findOne({ assignmentId, studentId: user.id })
      .lean();

    const shouldExposeAiReview =
      !!submission &&
      ((submission.aiScore !== null && submission.aiScore !== undefined) ||
        !!submission.aiReviewMetadata);

    return this.appService.envelope(
      {
        assignment: {
          id: assignment._id.toString(),
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.endDate,
          endDate: assignment.endDate,
          maxScore: 100,
          teacherName: assignment.teacherName,
          aiRule: assignment.aiRule,
          questionMaterial: assignment.questionMaterial,
          referenceAnswer: assignment.referenceAnswer,
          gradingNotes: assignment.gradingNotes,
          submissionFormat: assignment.submissionFormat,
          status: assignment.status,
          terminatedReason: assignment.terminatedReason,
          createdAt: assignment.createdAt,
        },
        submission: submission ? this.toSubmissionPayload(submission) : null,
        aiReview:
          submission && shouldExposeAiReview
            ? {
                content: submission.aiReviewContent,
                score: submission.aiScore,
                reviewedAt: submission.aiReviewedAt,
                aiReviewMetadata: submission.aiReviewMetadata,
              }
            : null,
        teacherReview:
          submission && submission.teacherScore !== null && submission.teacherScore !== undefined
            ? {
                content: submission.teacherReviewContent,
                score: submission.teacherScore,
                reviewedAt: submission.teacherReviewedAt,
              }
            : null,
      },
      '获取成功',
    );
  }

  async deleteSubmission(
    authorization: string | undefined,
    body: DeleteSubmissionDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    const submission = await this.submissionModel.findById(body.submissionId);
    if (!submission) {
      throw new NotFoundException('提交不存在');
    }

    if (user.role !== 'superadmin') {
      this.assertRoles(user, ['student']);
      if (submission.studentId !== user.id) {
        throw new ForbiddenException('只能删除自己的提交');
      }
      if (!submission.isDraft) {
        throw new ForbiddenException('只能删除草稿提交');
      }
    }

    const deletedClassId = submission.classId;
    const deletedStudentId = submission.studentId;
    await this.submissionModel.findByIdAndDelete(body.submissionId);
    await this.syncMembershipSubmissionStats(deletedClassId, deletedStudentId);
    return this.appService.envelope(
      {
        success: true,
        message: '删除成功',
        resourceId: body.submissionId,
      },
      '删除成功',
    );
  }

  async getSubmissionList(authorization: string | undefined, query: SubmissionQueryDto) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertRoles(user, ['teacher', 'superadmin']);

    const teacherAssignments = await this.assignmentModel
      .find(user.role === 'superadmin' ? {} : { teacherId: user.id })
      .lean();
    const teacherAssignmentIds = teacherAssignments.map((item) => item._id.toString());

    const filter: Record<string, unknown> = {
      assignmentId: { $in: teacherAssignmentIds },
    };

    if (query.assignmentId) filter.assignmentId = query.assignmentId;
    if (query.classId) filter.classId = query.classId;
    if (query.status === 'submitted') {
      filter.status = { $in: ['submitted', 'ai_review_queued', 'ai_review_failed'] };
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.studentName) filter.studentName = { $regex: query.studentName, $options: 'i' };
    if (query.studentNumber) {
      filter.studentNumber = { $regex: query.studentNumber, $options: 'i' };
    }
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      const scoreFilter: Record<string, number> = {};
      if (query.minScore !== undefined) scoreFilter.$gte = Number(query.minScore);
      if (query.maxScore !== undefined) scoreFilter.$lte = Number(query.maxScore);
      filter.$or = [{ teacherScore: scoreFilter }, { aiScore: scoreFilter }];
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || 'submittedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.submissionModel
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.submissionModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => ({
          ...this.toSubmissionPayload(item),
          _id: item._id.toString(),
          assignmentTitle:
            teacherAssignments.find((assignment) => assignment._id.toString() === item.assignmentId)
              ?.title || '',
          teacherName:
            teacherAssignments.find((assignment) => assignment._id.toString() === item.assignmentId)
              ?.teacherName || '',
        })),
        total,
        page,
        pageSize: limit,
      },
      '获取成功',
    );
  }

  async getSubmissionDetail(authorization: string | undefined, submissionId: string) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertRoles(user, ['teacher', 'superadmin']);

    const item = await this.submissionModel.findById(submissionId).lean();
    if (!item) {
      throw new NotFoundException('提交不存在');
    }

    const assignment = await this.assignmentModel.findById(item.assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (user.role !== 'superadmin' && assignment.teacherId !== user.id) {
      throw new ForbiddenException('无权查看该提交');
    }

    return this.appService.envelope(
      {
        ...this.toSubmissionPayload(item),
        _id: item._id.toString(),
      },
      '获取成功',
    );
  }

  async teacherReview(authorization: string | undefined, body: TeacherReviewDto) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertRoles(user, ['teacher', 'superadmin']);

    const item = await this.submissionModel.findById(body.submissionId);
    if (!item) {
      throw new NotFoundException('提交不存在');
    }
    if (item.isDraft) {
      throw new BadRequestException('草稿提交不能批改');
    }

    const assignment = await this.assignmentModel.findById(item.assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }
    if (user.role !== 'superadmin' && assignment.teacherId !== user.id) {
      throw new ForbiddenException('无权批改该提交');
    }

    item.teacherScore = body.teacherScore;
    item.teacherReviewContent = body.teacherReviewContent;
    item.teacherReviewedAt = new Date();
    item.status = 'teacher_reviewed';
    await item.save();

    return this.appService.envelope({ success: true, id: item.id }, '批改成功');
  }

  private async markAiReviewQueued(item: SubmissionDocument) {
    if (!this.aiReviewQueueService) {
      item.status = 'submitted';
      item.aiReviewMetadata = {
        provider: 'doubao',
        modelUsed: 'doubao-seed-2-0-lite-260215',
        queueStatus: 'skipped',
        skippedReason: 'queue_disabled',
        skippedAt: new Date().toISOString(),
      };
      await item.save();

      await this.membershipModel.findOneAndUpdate(
        { classId: item.classId, studentId: item.studentId },
        {
          $set: {
            totalSubmissions: item.submissionCount,
            lastSubmissionTime: item.submittedAt || new Date(),
          },
        },
      );
      return;
    }

    item.status = 'ai_review_queued';
    item.aiReviewMetadata = {
      queuedAt: new Date().toISOString(),
      provider: 'doubao',
      modelUsed: 'doubao-seed-2-0-lite-260215',
      queueStatus: 'queued',
    };
    await item.save();
    await this.aiReviewQueueService.enqueueReview(item.id);

    await this.membershipModel.findOneAndUpdate(
      { classId: item.classId, studentId: item.studentId },
      {
        $set: {
          totalSubmissions: item.submissionCount,
          lastSubmissionTime: item.submittedAt || new Date(),
        },
      },
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

    this.assertTokenFreshForUser(user, decoded.iat);
    return user;
  }

  private async syncMembershipSubmissionStats(classId: string, studentId: string) {
    const latestSubmitted = await this.submissionModel
      .findOne({
        classId,
        studentId,
        isDraft: false,
      })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    await this.membershipModel.findOneAndUpdate(
      { classId, studentId },
      {
        $set: {
          totalSubmissions: latestSubmitted?.submissionCount || 0,
          lastSubmissionTime: latestSubmitted?.submittedAt || null,
        },
      },
    );
  }

  private assertRoles(
    user: UserDocument,
    allowedRoles: Array<'superadmin' | 'teacher' | 'student'>,
  ) {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('当前用户无权执行此操作');
    }
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

  private toSubmissionPayload(item: any) {
    return {
      id: item._id?.toString?.() || item.id,
      _id: item._id?.toString?.() || item.id,
      assignmentId: item.assignmentId,
      studentId: item.studentId,
      studentName: item.studentName,
      studentNumber: item.studentNumber,
      classId: item.classId,
      className: item.className,
      content: item.content,
      attachments: item.attachments || [],
      status: item.status === 'ai_review_queued' ? 'submitted' : item.status,
      isDraft: item.isDraft,
      submittedAt: item.submittedAt,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
      submissionCount: item.submissionCount || 0,
      aiScore: item.aiScore,
      aiReviewContent: item.aiReviewContent,
      aiReviewMetadata: item.aiReviewMetadata,
      teacherScore: item.teacherScore,
      teacherReviewContent: item.teacherReviewContent,
      teacherReviewedAt: item.teacherReviewedAt,
      aiReviewedAt: item.aiReviewedAt,
    };
  }
}
