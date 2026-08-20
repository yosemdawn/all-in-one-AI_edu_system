import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { access, mkdir, stat, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { basename, join, resolve, sep } from 'path';
import { Model, Types } from 'mongoose';
import { AppService } from '../app.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { DEFAULT_DOUBAO_MODEL } from '../common/doubao-models';
import {
  Assignment,
  AssignmentDocument,
} from '../assignments/schemas/assignment.schema';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AiReviewQueueService } from './ai-review-queue.service';
import { AiReviewConfigService } from './ai-review-config.service';
import { DeleteSubmissionDto } from './dto/delete-submission.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { TeacherReviewDto } from './dto/teacher-review.dto';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import {
  ALLOWED_SUBMISSION_FILE_TYPES,
  MAX_SUBMISSION_FILES,
  SUBMISSION_UPLOAD_DIR,
} from './submission-files.constants';

type DocumentIdentifier = string | { toString(): string };
type UploadedSubmissionFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type StoredSubmissionAttachment = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
};
type SubmissionSource = Pick<
  Submission,
  | 'assignmentId'
  | 'studentId'
  | 'studentName'
  | 'studentNumber'
  | 'classId'
  | 'className'
  | 'content'
  | 'attachments'
  | 'onlineAnswers'
  | 'objectiveResult'
  | 'status'
  | 'isDraft'
  | 'submittedAt'
  | 'submissionCount'
  | 'aiScore'
  | 'aiReviewContent'
  | 'aiReviewMetadata'
  | 'teacherScore'
  | 'teacherReviewContent'
  | 'teacherReviewedAt'
  | 'aiReviewedAt'
> & {
  _id?: DocumentIdentifier;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

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
    private readonly aiReviewConfigService: AiReviewConfigService,
    @Optional()
    private readonly aiReviewQueueService?: AiReviewQueueService,
  ) {}

  async submit(
    currentUser: AuthenticatedUser,
    payload: SubmitAssignmentDto,
    files: UploadedSubmissionFile[] = [],
  ) {
    this.assertRoles(currentUser, ['student']);

    const assignment = await this.assignmentModel.findById(
      payload.assignmentId,
    );
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
    const isOnlineAssignment = assignment.assignmentType === 'online';
    let existing = await this.submissionModel.findOne({
      assignmentId: payload.assignmentId,
      studentId: currentUser.id,
    });
    const existingAttachments = this.readStoredAttachments(
      existing?.attachments || [],
    );
    const retainedAttachments = isOnlineAssignment
      ? []
      : this.selectRetainedAttachments(
          existingAttachments,
          payload.retainedAttachmentIds,
        );

    this.assertAttachmentRequestAllowed(
      assignment.allowAttachments,
      isOnlineAssignment,
      files,
      retainedAttachments,
    );

    const submissionContent = isOnlineAssignment
      ? this.buildOnlineSubmissionContent(payload.onlineAnswers || [])
      : String(payload.content || '').trim();
    const onlineAnswers = isOnlineAssignment
      ? this.normalizeOnlineAnswers(payload.onlineAnswers)
      : [];
    const objectiveGrading =
      isOnlineAssignment && !payload.isDraft
        ? this.gradeOnlineAnswers(assignment.onlineQuestions || [], onlineAnswers)
        : null;
    const objectiveResult = objectiveGrading?.result || null;

    if (
      !isOnlineAssignment &&
      !submissionContent &&
      retainedAttachments.length + files.length === 0
    ) {
      throw new BadRequestException(
        'Submission content or at least one attachment is required',
      );
    }

    const newAttachments = isOnlineAssignment
      ? []
      : await this.storeSubmissionFiles(currentUser.id, files);
    const attachments = [...retainedAttachments, ...newAttachments];
    const removedAttachments = existingAttachments.filter(
      (attachment) =>
        !retainedAttachments.some((retained) => retained.id === attachment.id),
    );
    let submissionPersisted = false;

    try {
      if (existing) {
        const previousSubmittedCount = existing.isDraft
          ? 0
          : existing.submissionCount || 0;
        if (!payload.isDraft && existing.status === 'teacher_reviewed') {
          throw new BadRequestException(
            'Reviewed submissions cannot be submitted again',
          );
        }
        if (!payload.isDraft && previousSubmittedCount >= 2) {
          throw new BadRequestException('Submission limit reached');
        }

        existing.classId = targetClassId;
        existing.className = className;
        existing.content = submissionContent;
        existing.attachments = attachments;
        existing.onlineAnswers = onlineAnswers;
        existing.objectiveResult = objectiveResult;
        existing.isDraft = !!payload.isDraft;
        existing.status = payload.isDraft
          ? 'draft'
          : isOnlineAssignment
            ? 'ai_reviewed'
            : 'submitted';
        existing.submittedAt = payload.isDraft
          ? existing.submittedAt
          : new Date();
        existing.aiScore = objectiveGrading?.score ?? null;
        existing.aiReviewContent = objectiveGrading?.review || null;
        existing.aiReviewMetadata = objectiveGrading?.metadata || null;
        existing.aiReviewedAt = objectiveGrading ? new Date() : null;
        existing.teacherScore = null;
        existing.teacherReviewContent = null;
        existing.teacherReviewedAt = null;
        existing.submissionCount = payload.isDraft
          ? previousSubmittedCount
          : previousSubmittedCount + 1;
        await existing.save();
        submissionPersisted = true;
      } else {
        existing = await this.submissionModel.create({
          _id: new Types.ObjectId(),
          assignmentId: payload.assignmentId,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentNumber: currentUser.studentId,
          classId: targetClassId,
          className,
          content: submissionContent,
          attachments,
          onlineAnswers,
          objectiveResult,
          status: payload.isDraft
            ? 'draft'
            : isOnlineAssignment
              ? 'ai_reviewed'
              : 'submitted',
          isDraft: !!payload.isDraft,
          submittedAt: payload.isDraft ? null : new Date(),
          submissionCount: payload.isDraft ? 0 : 1,
          aiScore: objectiveGrading?.score ?? null,
          aiReviewContent: objectiveGrading?.review || null,
          aiReviewMetadata: objectiveGrading?.metadata || null,
          aiReviewedAt: objectiveGrading ? new Date() : null,
          teacherScore: null,
          teacherReviewContent: null,
          teacherReviewedAt: null,
        });
        submissionPersisted = true;
      }

      if (!payload.isDraft && isOnlineAssignment) {
        await this.syncMembershipAfterSubmission(existing);
      } else if (!payload.isDraft) {
        await this.markAiReviewQueued(existing);
      }
    } catch (error) {
      if (!submissionPersisted) {
        await this.deleteStoredAttachments(newAttachments);
      }
      throw error;
    }

    await this.deleteStoredAttachments(removedAttachments);

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
          assignmentType: assignment.assignmentType || 'normal',
          onlineQuestions:
            assignment.assignmentType === 'online'
              ? this.toStudentOnlineQuestions(assignment.onlineQuestions || [])
              : [],
          gradingNotes: assignment.gradingNotes,
          submissionFormat: assignment.submissionFormat,
          allowAttachments: !!assignment.allowAttachments,
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
          submission &&
          submission.teacherScore !== null &&
          submission.teacherScore !== undefined
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

  async deleteSubmission(
    currentUser: AuthenticatedUser,
    body: DeleteSubmissionDto,
  ) {
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
    const deletedAttachments = this.readStoredAttachments(
      submission.attachments || [],
    );
    await this.submissionModel.findByIdAndDelete(body.submissionId);
    await this.deleteStoredAttachments(deletedAttachments);
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

  async getAttachmentFile(
    currentUser: AuthenticatedUser,
    submissionId: string,
    attachmentId: string,
  ) {
    const submission = await this.submissionModel.findById(submissionId).lean();
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (currentUser.role === 'student') {
      if (submission.studentId !== currentUser.id) {
        throw new ForbiddenException('Forbidden');
      }
    } else if (currentUser.role !== 'superadmin') {
      this.assertRoles(currentUser, ['teacher']);
      const assignment = await this.assignmentModel
        .findById(submission.assignmentId)
        .select('teacherId')
        .lean();
      if (!assignment || assignment.teacherId !== currentUser.id) {
        throw new ForbiddenException('Forbidden');
      }
    }

    const attachment = this.readStoredAttachments(
      submission.attachments || [],
    ).find((item) => item.id === attachmentId);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const path = this.resolveStoredAttachmentPath(attachment.storagePath);
    try {
      await access(path);
      const fileStat = await stat(path);
      return {
        path,
        fileName: attachment.fileName,
        mimeType: attachment.fileType || 'application/octet-stream',
        size: fileStat.size,
      };
    } catch {
      throw new NotFoundException('Attachment file not found');
    }
  }

  async getSubmissionList(
    currentUser: AuthenticatedUser,
    query: SubmissionQueryDto,
  ) {
    this.assertRoles(currentUser, ['teacher', 'superadmin']);

    const teacherAssignments = await this.assignmentModel
      .find(
        currentUser.role === 'superadmin' ? {} : { teacherId: currentUser.id },
      )
      .lean();
    const teacherAssignmentIds = teacherAssignments.map((item) =>
      item._id.toString(),
    );

    const filter: Record<string, unknown> = {
      assignmentId: { $in: teacherAssignmentIds },
    };

    if (query.assignmentId) filter.assignmentId = query.assignmentId;
    if (query.classId) filter.classId = query.classId;
    if (query.status === 'submitted') {
      filter.status = {
        $in: ['submitted', 'ai_review_queued', 'ai_review_failed'],
      };
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.studentName)
      filter.studentName = { $regex: query.studentName, $options: 'i' };
    if (query.studentNumber) {
      filter.studentNumber = { $regex: query.studentNumber, $options: 'i' };
    }
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      const scoreFilter: Record<string, number> = {};
      if (query.minScore !== undefined)
        scoreFilter.$gte = Number(query.minScore);
      if (query.maxScore !== undefined)
        scoreFilter.$lte = Number(query.maxScore);
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
            teacherAssignments.find(
              (assignment) => assignment._id.toString() === item.assignmentId,
            )?.title || '',
          teacherName:
            teacherAssignments.find(
              (assignment) => assignment._id.toString() === item.assignmentId,
            )?.teacherName || '',
        })),
        total,
        page,
        pageSize: limit,
      },
      'success',
    );
  }

  async getSubmissionDetail(
    currentUser: AuthenticatedUser,
    submissionId: string,
  ) {
    this.assertRoles(currentUser, ['teacher', 'superadmin']);

    const item = await this.submissionModel.findById(submissionId).lean();
    if (!item) {
      throw new NotFoundException('Submission not found');
    }

    const assignment = await this.assignmentModel
      .findById(item.assignmentId)
      .lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (
      currentUser.role !== 'superadmin' &&
      assignment.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'You are not allowed to view this submission',
      );
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

    const assignment = await this.assignmentModel
      .findById(item.assignmentId)
      .lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (
      currentUser.role !== 'superadmin' &&
      assignment.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'You are not allowed to review this submission',
      );
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
      if (this.aiReviewConfigService.aiReviewRequired) {
        item.status = 'ai_review_failed';
        item.aiReviewMetadata = {
          provider: 'doubao',
          modelUsed: DEFAULT_DOUBAO_MODEL,
          queueStatus: 'failed',
          error: 'AI review queue is unavailable',
          failedAt: new Date().toISOString(),
        };
        await item.save();
      } else {
        item.status = 'submitted';
        item.aiReviewMetadata = {
          provider: 'doubao',
          modelUsed: DEFAULT_DOUBAO_MODEL,
          queueStatus: 'skipped',
          skippedReason: 'queue_disabled',
          skippedAt: new Date().toISOString(),
        };
        await item.save();
      }

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
      modelUsed: DEFAULT_DOUBAO_MODEL,
      queueStatus: 'queued',
    };
    await item.save();
    try {
      await this.aiReviewQueueService.enqueueReview(item.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to enqueue AI review';
      this.logger.error(`Failed to enqueue submission ${item.id}: ${message}`);
      item.status = 'ai_review_failed';
      item.aiReviewMetadata = {
        provider: 'doubao',
        modelUsed: DEFAULT_DOUBAO_MODEL,
        queueStatus: 'failed',
        error: message,
        failedAt: new Date().toISOString(),
      };
      await item.save();
    }

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

  private async syncMembershipAfterSubmission(item: SubmissionDocument) {
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

  private normalizeOnlineAnswers(answers?: Array<Record<string, unknown>>) {
    return (Array.isArray(answers) ? answers : []).map((item) => ({
      questionId: String(item.questionId || ''),
      answer: String(item.answer ?? ''),
    }));
  }

  private buildOnlineSubmissionContent(answers?: Array<Record<string, unknown>>) {
    const normalized = this.normalizeOnlineAnswers(answers);
    return normalized
      .map((item, index) => `${index + 1}. ${item.answer}`)
      .join('\n');
  }

  private gradeOnlineAnswers(
    questions: Assignment['onlineQuestions'],
    answers: Array<{ questionId: string; answer: string }>,
  ) {
    const answerMap = new Map(
      answers.map((item) => [item.questionId, item.answer]),
    );
    const details = (questions || []).map((question, index) => {
      const studentAnswer = answerMap.get(question.id) ?? '';
      const correctAnswer = question.answer;
      const isCorrect = studentAnswer === correctAnswer;
      const score = Number(question.score || 1);

      return {
        questionId: question.id,
        questionNumber: index + 1,
        type: question.type,
        stem: question.stem,
        studentAnswer,
        correctAnswer,
        isCorrect,
        score: isCorrect ? score : 0,
        maxScore: score,
      };
    });
    const totalScore = details.reduce((sum, item) => sum + item.score, 0);
    const maxScore = details.reduce((sum, item) => sum + item.maxScore, 0);
    const score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const correctCount = details.filter((item) => item.isCorrect).length;

    return {
      score,
      review: `在线客观题自动判分：${correctCount}/${details.length} 题正确，原始得分 ${totalScore}/${maxScore}。填空题按完全一致规则判定，包含英文字母大小写。`,
      metadata: {
        provider: 'objective_auto_grader',
        queueStatus: 'completed',
        modelUsed: 'objective-auto-grader',
        completedAt: new Date().toISOString(),
        objectiveResult: {
          score,
          totalScore,
          maxScore,
          correctCount,
          totalQuestions: details.length,
          details,
        },
      },
      result: {
        score,
        totalScore,
        maxScore,
        correctCount,
        totalQuestions: details.length,
        details,
      },
    };
  }

  private toStudentOnlineQuestions(questions: Assignment['onlineQuestions']) {
    return (questions || []).map((question) => ({
      id: question.id,
      type: question.type,
      stem: question.stem,
      options: question.options || [],
      score: question.score || 1,
    }));
  }

  private async syncMembershipSubmissionStats(
    classId: string,
    studentId: string,
  ) {
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

  private assertAttachmentRequestAllowed(
    allowAttachments: boolean | undefined,
    isOnlineAssignment: boolean,
    files: UploadedSubmissionFile[],
    retainedAttachments: StoredSubmissionAttachment[],
  ) {
    if (isOnlineAssignment && (files.length || retainedAttachments.length)) {
      throw new BadRequestException(
        'Online assignments do not support file attachments',
      );
    }
    if (!allowAttachments && (files.length || retainedAttachments.length)) {
      throw new BadRequestException('Attachments are not allowed');
    }
    if (files.length + retainedAttachments.length > MAX_SUBMISSION_FILES) {
      throw new BadRequestException(
        `A submission can contain at most ${MAX_SUBMISSION_FILES} attachments`,
      );
    }
    const invalidFile = files.find(
      (file) => !ALLOWED_SUBMISSION_FILE_TYPES.has(file.mimetype),
    );
    if (invalidFile) {
      throw new BadRequestException(
        `Unsupported attachment type: ${invalidFile.originalname}`,
      );
    }
  }

  private selectRetainedAttachments(
    existingAttachments: StoredSubmissionAttachment[],
    retainedAttachmentIds?: string[],
  ) {
    if (retainedAttachmentIds === undefined) {
      return existingAttachments;
    }

    const requestedIds = new Set(retainedAttachmentIds);
    if (
      [...requestedIds].some(
        (id) => !existingAttachments.some((attachment) => attachment.id === id),
      )
    ) {
      throw new BadRequestException('Invalid retained attachment');
    }
    return existingAttachments.filter((attachment) =>
      requestedIds.has(attachment.id),
    );
  }

  private async storeSubmissionFiles(
    studentId: string,
    files: UploadedSubmissionFile[],
  ): Promise<StoredSubmissionAttachment[]> {
    if (!files.length) return [];

    const safeStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const relativeDir = join(SUBMISSION_UPLOAD_DIR, safeStudentId);
    const absoluteDir = resolve(process.cwd(), relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const stored: StoredSubmissionAttachment[] = [];
    try {
      for (const file of files) {
        const id = randomUUID();
        const safeName = basename(file.originalname).replace(
          /[^a-zA-Z0-9._-]/g,
          '_',
        );
        const storagePath = join(relativeDir, `${id}-${safeName}`);
        await writeFile(resolve(process.cwd(), storagePath), file.buffer);
        stored.push({
          id,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          storagePath,
        });
      }
      return stored;
    } catch (error) {
      await this.deleteStoredAttachments(stored);
      throw error;
    }
  }

  private readStoredAttachments(
    attachments: Array<Record<string, unknown>>,
  ): StoredSubmissionAttachment[] {
    return attachments
      .map((attachment) => ({
        id: String(attachment.id || attachment.toolTaskId || ''),
        fileName: String(attachment.fileName || ''),
        fileSize: Number(attachment.fileSize || 0),
        fileType: String(attachment.fileType || ''),
        storagePath: String(
          attachment.storagePath || attachment.localPath || '',
        ),
      }))
      .filter((attachment) => attachment.id && attachment.storagePath);
  }

  private resolveStoredAttachmentPath(storagePath: string) {
    const allowedBaseDirs = [
      resolve(process.cwd(), SUBMISSION_UPLOAD_DIR),
      resolve(process.cwd(), 'uploads/teacher-tools'),
    ];
    const resolvedPath = resolve(process.cwd(), storagePath);
    if (
      !allowedBaseDirs.some(
        (baseDir) =>
          resolvedPath === baseDir || resolvedPath.startsWith(`${baseDir}${sep}`),
      )
    ) {
      throw new ForbiddenException('Invalid attachment path');
    }
    return resolvedPath;
  }

  private async deleteStoredAttachments(
    attachments: StoredSubmissionAttachment[],
  ) {
    await Promise.all(
      attachments.map(async (attachment) => {
        try {
          const path = this.resolveStoredAttachmentPath(attachment.storagePath);
          const submissionBaseDir = resolve(
            process.cwd(),
            SUBMISSION_UPLOAD_DIR,
          );
          if (!path.startsWith(`${submissionBaseDir}${sep}`)) {
            return;
          }
          await unlink(path);
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            this.logger.warn(
              `Failed to delete attachment ${attachment.storagePath}`,
            );
          }
        }
      }),
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

  private readEntityId(item: { _id?: DocumentIdentifier; id?: string }) {
    return item._id?.toString?.() || item.id || '';
  }

  private toSubmissionPayload(item: SubmissionSource) {
    const submissionId = this.readEntityId(item);
    return {
      id: submissionId,
      _id: submissionId,
      assignmentId: item.assignmentId,
      studentId: item.studentId,
      studentName: item.studentName,
      studentNumber: item.studentNumber,
      classId: item.classId,
      className: item.className,
      content: item.content,
      attachments: this.readStoredAttachments(item.attachments || []).map(
        (attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          fileType: attachment.fileType,
          fileUrl: `/students/submissions/${submissionId}/attachments/${attachment.id}`,
        }),
      ),
      onlineAnswers: item.onlineAnswers || [],
      objectiveResult: item.objectiveResult || null,
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
