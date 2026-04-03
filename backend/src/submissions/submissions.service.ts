import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
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
    private readonly appService: AppService,
    @Optional()
    private readonly aiReviewQueueService?: AiReviewQueueService,
  ) {}

  async submit(currentUser: AuthenticatedUser, payload: SubmitAssignmentDto) {
    this.assertRoles(currentUser, ['student']);

    const assignment = await this.assignmentModel.findById(payload.assignmentId);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.status !== 'published') {
      throw new BadRequestException('Assignment is not open for submission');
    }
    if (new Date(assignment.endDate).getTime() < Date.now()) {
      throw new BadRequestException('Assignment is expired');
    }

    const allowedClassIds = assignment.classes.map((item) => item.id);
    const targetClassId = payload.classId || currentUser.classId;
    if (!targetClassId || !allowedClassIds.includes(targetClassId)) {
      throw new BadRequestException('Class does not match assignment');
    }

    const classItem = await this.classModel.findById(targetClassId).lean();
    if (!classItem || classItem.status !== 'active') {
      throw new BadRequestException('Class is not active');
    }

    const member = await this.membershipModel.findOne({
      classId: targetClassId,
      studentId: currentUser.id,
      status: 'active',
    });
    if (!member) {
      throw new BadRequestException('Student is not in this class');
    }

    const className =
      assignment.classes.find((item) => item.id === targetClassId)?.name ||
      currentUser.className ||
      '';

    let existing = await this.submissionModel.findOne({
      assignmentId: payload.assignmentId,
      studentId: currentUser.id,
    });

    if (existing) {
      const previousSubmittedCount = existing.isDraft ? 0 : existing.submissionCount || 0;
      if (!payload.isDraft && existing.status === 'teacher_reviewed') {
        throw new BadRequestException('Reviewed submissions cannot be submitted again');
      }
      if (!payload.isDraft && previousSubmittedCount >= 2) {
        throw new BadRequestException('Submission limit reached');
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
        payload.isDraft ? 'draft saved' : 'submitted',
      );
    }

    existing = await this.submissionModel.create({
      assignmentId: payload.assignmentId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentNumber: currentUser.studentId,
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
      payload.isDraft ? 'draft saved' : 'submitted',
    );
  }

  async getMySubmission(currentUser: AuthenticatedUser, assignmentId: string) {
    this.assertRoles(currentUser, ['student']);

    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const submission = await this.submissionModel
      .findOne({ assignmentId, studentId: currentUser.id })
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
      'success',
    );
  }

  async deleteSubmission(currentUser: AuthenticatedUser, body: DeleteSubmissionDto) {
    const submission = await this.submissionModel.findById(body.submissionId);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (currentUser.role !== 'superadmin') {
      this.assertRoles(currentUser, ['student']);
      if (submission.studentId !== currentUser.id) {
        throw new ForbiddenException('You can only delete your own submission');
      }
      if (!submission.isDraft) {
        throw new ForbiddenException('Only draft submissions can be deleted');
      }
    }

    const deletedClassId = submission.classId;
    const deletedStudentId = submission.studentId;
    await this.submissionModel.findByIdAndDelete(body.submissionId);
    await this.syncMembershipSubmissionStats(deletedClassId, deletedStudentId);
    return this.appService.envelope(
      {
        success: true,
        message: 'deleted',
        resourceId: body.submissionId,
      },
      'success',
    );
  }

  async getSubmissionList(currentUser: AuthenticatedUser, query: SubmissionQueryDto) {
    this.assertRoles(currentUser, ['teacher', 'superadmin']);

    const teacherAssignments = await this.assignmentModel
      .find(currentUser.role === 'superadmin' ? {} : { teacherId: currentUser.id })
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
      'success',
    );
  }

  async getSubmissionDetail(currentUser: AuthenticatedUser, submissionId: string) {
    this.assertRoles(currentUser, ['teacher', 'superadmin']);

    const item = await this.submissionModel.findById(submissionId).lean();
    if (!item) {
      throw new NotFoundException('Submission not found');
    }

    const assignment = await this.assignmentModel.findById(item.assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (currentUser.role !== 'superadmin' && assignment.teacherId !== currentUser.id) {
      throw new ForbiddenException('You are not allowed to view this submission');
    }

    return this.appService.envelope(
      {
        ...this.toSubmissionPayload(item),
        _id: item._id.toString(),
      },
      'success',
    );
  }

  async teacherReview(currentUser: AuthenticatedUser, body: TeacherReviewDto) {
    this.assertRoles(currentUser, ['teacher', 'superadmin']);

    const item = await this.submissionModel.findById(body.submissionId);
    if (!item) {
      throw new NotFoundException('Submission not found');
    }
    if (item.isDraft) {
      throw new BadRequestException('Draft submissions cannot be reviewed');
    }

    const assignment = await this.assignmentModel.findById(item.assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (currentUser.role !== 'superadmin' && assignment.teacherId !== currentUser.id) {
      throw new ForbiddenException('You are not allowed to review this submission');
    }

    item.teacherScore = body.teacherScore;
    item.teacherReviewContent = body.teacherReviewContent;
    item.teacherReviewedAt = new Date();
    item.status = 'teacher_reviewed';
    await item.save();

    return this.appService.envelope({ success: true, id: item.id }, 'success');
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
    user: AuthenticatedUser,
    allowedRoles: Array<'superadmin' | 'teacher' | 'student'>,
  ) {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden');
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
