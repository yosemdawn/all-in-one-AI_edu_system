import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import {
  Assignment,
  AssignmentDocument,
} from '../assignments/schemas/assignment.schema';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import {
  TEACHER_TOOLS_QUEUE,
  TOOL_UPLOAD_DIR,
} from './teacher-tools.constants';
import { DoubaoVisionService } from './doubao-vision.service';
import {
  ObjectiveGradingService,
  StandardAnswerMap,
} from './objective-grading.service';
import { ToolTaskQueryDto } from './dto/tool-task-query.dto';
import {
  Submission,
  SubmissionDocument,
} from '../submissions/schemas/submission.schema';
import {
  ToolTask,
  ToolTaskDocument,
  ToolTaskStatus,
  ToolTaskType,
} from './schemas/tool-task.schema';
import { TeacherToolsQueueService } from './teacher-tools-queue.service';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type StoredFile = {
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
};

@Injectable()
export class TeacherToolsService {
  constructor(
    @InjectModel(ToolTask.name)
    private readonly toolTaskModel: Model<ToolTaskDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly appService: AppService,
    private readonly doubaoVisionService: DoubaoVisionService,
    private readonly objectiveGradingService: ObjectiveGradingService,
    @Optional()
    private readonly queueService?: TeacherToolsQueueService,
  ) {}

  async parseStandardAnswers(currentUser: AuthenticatedUser, text: string) {
    this.assertTeacher(currentUser);
    const result = await this.doubaoVisionService.parseStandardAnswers(text, {
      teacherId: currentUser.id,
    });
    const standardAnswers = this.objectiveGradingService.normalizeStandardAnswers(
      result.data,
    );
    return this.appService.envelope({ standardAnswers }, 'success');
  }

  async parseScoreConfig(currentUser: AuthenticatedUser, text: string) {
    this.assertTeacher(currentUser);
    const result = await this.doubaoVisionService.parseScoreConfig(text, {
      teacherId: currentUser.id,
    });
    const scoreConfig = this.objectiveGradingService.normalizeScoreConfig(
      result.data,
    );
    return this.appService.envelope({ scoreConfig }, 'success');
  }

  async previewEssayRequirements(
    currentUser: AuthenticatedUser,
    body: Record<string, unknown>,
    requirementImages: UploadedFile[],
  ) {
    this.assertTeacher(currentUser);
    const storedFiles = await this.storeFiles(
      requirementImages || [],
      'essay-requirements-preview',
    );
    const result = await this.doubaoVisionService.previewEssayRequirements(
      storedFiles,
      this.readString(body.requirementText),
      { teacherId: currentUser.id },
    );
    return this.appService.envelope(result.data, 'success');
  }

  async createObjectiveTask(
    currentUser: AuthenticatedUser,
    body: Record<string, unknown>,
    files: UploadedFile[],
  ) {
    this.assertTeacher(currentUser);
    if (!files?.length) {
      throw new BadRequestException('At least one answer-card image is required');
    }

    const standardAnswers =
      this.objectiveGradingService.normalizeStandardAnswers(
        this.parseJsonField(body.standardAnswers, {}),
      );
    if (!Object.keys(standardAnswers).length) {
      throw new BadRequestException('Standard answers are required');
    }

    const scoreConfig = this.objectiveGradingService.normalizeScoreConfig(
      this.parseJsonField(body.scoreConfig, {}),
    );
    let classInfo = await this.resolveClass(currentUser, body.classId);
    const assignmentInfo = await this.resolveAssignment(
      currentUser,
      body.assignmentId,
      classInfo?.id,
    );
    classInfo = classInfo || this.singleAssignmentClass(assignmentInfo);
    const storedFiles = await this.storeFiles(files, 'objective-grading');
    const task = await this.toolTaskModel.create({
      type: 'objective_grading',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
      assignmentId: assignmentInfo?.id || null,
      assignmentTitle: assignmentInfo?.title || null,
      title:
        this.readString(body.title) ||
        `${classInfo?.name || '未关联班级'}客观题批分`,
      status: 'queued',
      totalCount: storedFiles.length,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      config: {
        standardAnswers,
        scoreConfig,
        files: storedFiles,
        syncToSubmissions:
          !!assignmentInfo && this.readBoolean(body.syncToSubmissions, true),
        overwriteExistingSubmissions: this.readBoolean(
          body.overwriteExistingSubmissions,
          false,
        ),
      },
      items: [],
      resultSummary: {},
    });

    await this.dispatchTask(task.id);
    return this.appService.envelope(this.toTaskPayload(task), 'queued');
  }

  async createEssayTask(
    currentUser: AuthenticatedUser,
    body: Record<string, unknown>,
    files: {
      requirementImages?: UploadedFile[];
      essayImages?: UploadedFile[];
    },
  ) {
    this.assertTeacher(currentUser);
    const essayImages = files.essayImages || [];
    if (!essayImages.length) {
      throw new BadRequestException('At least one essay image is required');
    }

    let classInfo = await this.resolveClass(currentUser, body.classId);
    const assignmentInfo = await this.resolveAssignment(
      currentUser,
      body.assignmentId,
      classInfo?.id,
    );
    classInfo = classInfo || this.singleAssignmentClass(assignmentInfo);
    const [storedRequirementImages, storedEssayImages] = await Promise.all([
      this.storeFiles(files.requirementImages || [], 'essay-requirements'),
      this.storeFiles(essayImages, 'essay-batch'),
    ]);
    const task = await this.toolTaskModel.create({
      type: 'essay_batch',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
      assignmentId: assignmentInfo?.id || null,
      assignmentTitle: assignmentInfo?.title || null,
      title:
        this.readString(body.title) ||
        `${classInfo?.name || '未关联班级'}批量作文检查`,
      status: 'queued',
      totalCount: storedEssayImages.length,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      config: {
        requirementText: this.readString(body.requirementText) || '',
        requirementImages: storedRequirementImages,
        essayImages: storedEssayImages,
        syncToSubmissions:
          !!assignmentInfo && this.readBoolean(body.syncToSubmissions, true),
        overwriteExistingSubmissions: this.readBoolean(
          body.overwriteExistingSubmissions,
          false,
        ),
      },
      items: [],
      resultSummary: {},
    });

    await this.dispatchTask(task.id);
    return this.appService.envelope(this.toTaskPayload(task), 'queued');
  }

  async listTasks(currentUser: AuthenticatedUser, query: ToolTaskQueryDto) {
    this.assertTeacher(currentUser);
    const filter: Record<string, unknown> = {};
    if (currentUser.role !== 'superadmin') {
      filter.teacherId = currentUser.id;
    }
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    const page = Number(query.page || 1);
    const limit = Math.min(Number(query.limit || 20), 100);
    const [items, total] = await Promise.all([
      this.toolTaskModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.toolTaskModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toTaskPayload(item)),
        total,
        page,
        limit,
      },
      'success',
    );
  }

  async getTask(currentUser: AuthenticatedUser, id: string) {
    const task = await this.requireTaskAccess(currentUser, id);
    return this.appService.envelope(this.toTaskPayload(task), 'success');
  }

  async cancelTask(currentUser: AuthenticatedUser, id: string) {
    const task = await this.requireTaskAccess(currentUser, id);
    if (['completed', 'partial_failed', 'failed', 'cancelled'].includes(task.status)) {
      return this.appService.envelope(this.toTaskPayload(task), 'success');
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    await task.save();
    return this.appService.envelope(this.toTaskPayload(task), 'cancelled');
  }

  async exportTask(currentUser: AuthenticatedUser, id: string) {
    const task = await this.requireTaskAccess(currentUser, id);
    return {
      filename: `${task.title || task.type}-${task.id}.csv`,
      content: this.buildCsv(task),
    };
  }

  async processTask(id: string) {
    const task = await this.toolTaskModel.findById(id);
    if (!task || task.status === 'cancelled') {
      return;
    }

    task.status = 'processing';
    await task.save();

    try {
      if (task.type === 'objective_grading') {
        await this.processObjectiveTask(task);
      } else {
        await this.processEssayTask(task);
      }
    } catch (error: unknown) {
      task.status = task.successCount > 0 ? 'partial_failed' : 'failed';
      task.completedAt = new Date();
      task.resultSummary = {
        ...(task.resultSummary || {}),
        error: this.getErrorMessage(error),
      };
      await task.save();
    }
  }

  private async processObjectiveTask(task: ToolTaskDocument) {
    const config = task.config as {
      files?: StoredFile[];
      standardAnswers?: StandardAnswerMap;
      scoreConfig?: Record<string, number>;
    };
    const files = config.files || [];
    const standardAnswers =
      this.objectiveGradingService.normalizeStandardAnswers(
        config.standardAnswers || {},
      );
    const scoreConfig = this.objectiveGradingService.normalizeScoreConfig(
      config.scoreConfig || {},
    );

    for (const file of files) {
      if (await this.isTaskCancelled(task.id)) return;
      const itemBase = {
        fileName: file.originalName,
        filePath: file.path,
        status: 'processing',
      };
      await this.pushOrReplaceItem(task, itemBase);

      try {
        const recognized = await this.doubaoVisionService.recognizeAnswerCard(
          file,
          { teacherId: task.teacherId },
        );
        if (await this.isTaskCancelled(task.id)) return;
        const grading = this.objectiveGradingService.gradeStudentAnswers(
          recognized.data.answers || {},
          standardAnswers,
          scoreConfig,
        );
        const totalScore = this.objectiveGradingService.calculateTotalScore(
          grading,
        );
        const matchedStudent = await this.matchStudent(task.classId, {
          studentName: recognized.data.studentName,
          studentNumber: recognized.data.studentNumber,
        });

        const completedItem = {
          ...itemBase,
          status: 'completed',
          studentName: recognized.data.studentName || '',
          studentNumber: recognized.data.studentNumber || '',
          matchedStudent,
          answers: recognized.data.answers || {},
          grading,
          totalScore,
          rawContent: recognized.rawContent,
        };
        const syncResult = await this.syncItemToSubmission(
          task,
          completedItem,
        );
        await this.pushOrReplaceItem(task, {
          ...completedItem,
          submissionSync: syncResult,
        });
        task.successCount += 1;
      } catch (error: unknown) {
        await this.pushOrReplaceItem(task, {
          ...itemBase,
          status: 'failed',
          error: this.getErrorMessage(error),
        });
        task.failureCount += 1;
      }

      task.processedCount += 1;
      task.resultSummary = this.buildObjectiveSummary(task.items);
      await task.save();
    }

    this.finishTask(task);
    await task.save();
  }

  private async processEssayTask(task: ToolTaskDocument) {
    const config = task.config as {
      requirementText?: string;
      requirementImages?: StoredFile[];
      essayImages?: StoredFile[];
    };
    let requirementsText = config.requirementText || '';
    const requirementImages = config.requirementImages || [];
    const essayImages = config.essayImages || [];

    if (!requirementsText && requirementImages.length) {
      const preview = await this.doubaoVisionService.previewEssayRequirements(
        requirementImages,
        undefined,
        { teacherId: task.teacherId },
      );
      requirementsText = preview.data.requirements || '';
      task.config = { ...task.config, requirementText: requirementsText };
      await task.save();
    }

    for (const file of essayImages) {
      if (await this.isTaskCancelled(task.id)) return;
      const itemBase = {
        fileName: file.originalName,
        filePath: file.path,
        status: 'processing',
      };
      await this.pushOrReplaceItem(task, itemBase);

      try {
        const reviewed = await this.doubaoVisionService.reviewEssay({
          requirementsText,
          requirementImages,
          essayImage: file,
        }, {
          teacherId: task.teacherId,
        });
        if (await this.isTaskCancelled(task.id)) return;
        const score = this.clampScore(reviewed.data.score);
        const matchedStudent = await this.matchStudent(task.classId, {
          studentName: reviewed.data.studentName,
          studentNumber: reviewed.data.studentNumber,
        });

        const completedItem = {
          ...itemBase,
          status: 'completed',
          studentName: reviewed.data.studentName || '',
          studentNumber: reviewed.data.studentNumber || '',
          matchedStudent,
          essayText: reviewed.data.essayText || '',
          score,
          strengths: reviewed.data.strengths || '',
          weaknesses: reviewed.data.weaknesses || '',
          suggestions: Array.isArray(reviewed.data.suggestions)
            ? reviewed.data.suggestions
            : [],
          summaryComment: reviewed.data.summary_comment || '',
          rawContent: reviewed.rawContent,
        };
        const syncResult = await this.syncItemToSubmission(
          task,
          completedItem,
        );
        await this.pushOrReplaceItem(task, {
          ...completedItem,
          submissionSync: syncResult,
        });
        task.successCount += 1;
      } catch (error: unknown) {
        await this.pushOrReplaceItem(task, {
          ...itemBase,
          status: 'failed',
          error: this.getErrorMessage(error),
        });
        task.failureCount += 1;
      }

      task.processedCount += 1;
      task.resultSummary = this.buildEssaySummary(task.items);
      await task.save();
    }

    this.finishTask(task);
    await task.save();
  }

  private async dispatchTask(taskId: string) {
    if (this.queueService) {
      await this.queueService.enqueueTask(taskId);
      return;
    }

    setTimeout(() => void this.processTask(taskId), 0);
  }

  private async resolveClass(
    currentUser: AuthenticatedUser,
    rawClassId: unknown,
  ) {
    const classId = this.readString(rawClassId);
    if (!classId) return null;

    const classItem = await this.classModel.findById(classId).lean();
    if (!classItem) {
      throw new BadRequestException('Class not found');
    }
    if (
      currentUser.role !== 'superadmin' &&
      classItem.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only use your own classes');
    }

    return { id: classItem._id.toString(), name: classItem.name };
  }

  private async resolveAssignment(
    currentUser: AuthenticatedUser,
    rawAssignmentId: unknown,
    classId?: string | null,
  ) {
    const assignmentId = this.readString(rawAssignmentId);
    if (!assignmentId) return null;

    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new BadRequestException('Assignment not found');
    }
    if (
      currentUser.role !== 'superadmin' &&
      assignment.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only use your own assignments');
    }
    if (classId && !assignment.classes.some((item) => item.id === classId)) {
      throw new BadRequestException('Assignment does not include this class');
    }
    if (!classId && assignment.classes.length !== 1) {
      throw new BadRequestException(
        'Class is required when the selected assignment has multiple classes',
      );
    }

    return {
      id: assignment._id.toString(),
      title: assignment.title,
      classes: assignment.classes,
    };
  }

  private async matchStudent(
    classId: string | null | undefined,
    input: { studentName?: string | null; studentNumber?: string | null },
  ) {
    if (!classId) {
      return { status: 'unmatched', reason: 'no_class_selected' };
    }

    const filter = { classId, status: 'active' };
    if (input.studentNumber?.trim()) {
      const student = await this.membershipModel
        .findOne({
          ...filter,
          studentNumber: input.studentNumber.trim(),
        })
        .lean();
      if (student) {
        return this.toMatchedStudent(student, 'studentNumber');
      }
    }

    if (input.studentName?.trim()) {
      const students = await this.membershipModel
        .find({
          ...filter,
          studentName: input.studentName.trim(),
        })
        .lean();
      if (students.length === 1) {
        return this.toMatchedStudent(students[0], 'studentName');
      }
      if (students.length > 1) {
        return { status: 'ambiguous', reason: 'duplicate_student_name' };
      }
    }

    return { status: 'unmatched', reason: 'no_student_match' };
  }

  private singleAssignmentClass(
    assignmentInfo: Awaited<ReturnType<TeacherToolsService['resolveAssignment']>>,
  ) {
    if (!assignmentInfo || assignmentInfo.classes.length !== 1) {
      return null;
    }
    const [classItem] = assignmentInfo.classes;
    return { id: classItem.id, name: classItem.name };
  }

  private toMatchedStudent(
    student: {
      studentId: string;
      studentName: string;
      studentNumber?: string;
      classId: string;
    },
    by: string,
  ) {
    return {
      status: 'matched',
      by,
      studentId: student.studentId,
      studentName: student.studentName,
      studentNumber: student.studentNumber,
      classId: student.classId,
    };
  }

  private async syncItemToSubmission(
    task: ToolTaskDocument,
    item: Record<string, unknown>,
  ) {
    const config = task.config as {
      syncToSubmissions?: boolean;
      overwriteExistingSubmissions?: boolean;
    };
    if (!config.syncToSubmissions || !task.assignmentId) {
      return { status: 'skipped', reason: 'no_assignment' };
    }

    const matched = item.matchedStudent as Record<string, unknown> | undefined;
    if (matched?.status !== 'matched' || !matched.studentId) {
      return { status: 'skipped', reason: 'student_not_matched' };
    }

    const assignment = await this.assignmentModel.findById(task.assignmentId).lean();
    if (!assignment) {
      return { status: 'failed', reason: 'assignment_not_found' };
    }

    const existing = await this.submissionModel.findOne({
      assignmentId: task.assignmentId,
      studentId: String(matched.studentId),
    });
    if (existing?.status === 'teacher_reviewed') {
      return {
        status: 'skipped',
        reason: 'teacher_reviewed',
        submissionId: existing.id,
      };
    }
    if (existing && !this.canOverwriteSubmission(existing, task, config)) {
      return {
        status: 'skipped',
        reason: 'existing_submission',
        submissionId: existing.id,
      };
    }

    const now = new Date();
    const score = this.readScoreForTask(task, item);
    const classId = String(matched.classId || task.classId || '');
    const className =
      task.className ||
      assignment.classes.find((classItem) => classItem.id === classId)?.name ||
      '';
    const content = this.buildSubmissionContent(task, item);
    const aiReviewContent = this.buildSubmissionReview(task, item);
    const attachments = [
      {
        fileName: String(item.fileName || ''),
        fileUrl: '',
        fileSize: 0,
        fileType: task.type,
        source: 'teacher_tools',
        toolTaskId: task.id,
        localPath: item.filePath,
      },
    ];
    const aiReviewMetadata = {
      provider: 'doubao',
      queueStatus: 'completed',
      source: 'teacher_tools',
      toolTaskId: task.id,
      toolTaskType: task.type,
      fileName: item.fileName,
      rawContent: item.rawContent,
      grading: item.grading,
      recognizedAnswers: item.answers,
      completedAt: now.toISOString(),
    };

    if (existing) {
      existing.classId = classId;
      existing.className = className;
      existing.content = content;
      existing.attachments = attachments;
      existing.isDraft = false;
      existing.status = 'ai_reviewed';
      existing.submittedAt = existing.submittedAt || now;
      existing.submissionCount = Math.max(existing.submissionCount || 0, 1);
      existing.aiScore = score;
      existing.aiReviewContent = aiReviewContent;
      existing.aiReviewMetadata = aiReviewMetadata;
      existing.aiReviewedAt = now;
      existing.teacherScore = null;
      existing.teacherReviewContent = null;
      existing.teacherReviewedAt = null;
      await existing.save();
      await this.syncMembershipSubmissionStats(classId, String(matched.studentId), existing);
      return { status: 'updated', submissionId: existing.id };
    }

    const created = await this.submissionModel.create({
      assignmentId: task.assignmentId,
      studentId: String(matched.studentId),
      studentName: String(matched.studentName || item.studentName || ''),
      studentNumber: String(matched.studentNumber || item.studentNumber || ''),
      classId,
      className,
      content,
      attachments,
      status: 'ai_reviewed',
      isDraft: false,
      submittedAt: now,
      submissionCount: 1,
      aiScore: score,
      aiReviewContent,
      aiReviewMetadata,
      aiReviewedAt: now,
      teacherScore: null,
      teacherReviewContent: null,
      teacherReviewedAt: null,
    });
    await this.syncMembershipSubmissionStats(classId, String(matched.studentId), created);
    return { status: 'created', submissionId: created.id };
  }

  private async syncMembershipSubmissionStats(
    classId: string,
    studentId: string,
    submission: SubmissionDocument,
  ) {
    await this.membershipModel.findOneAndUpdate(
      { classId, studentId },
      {
        $set: {
          totalSubmissions: submission.submissionCount || 1,
          lastSubmissionTime: submission.submittedAt || new Date(),
        },
      },
    );
  }

  private canOverwriteSubmission(
    submission: SubmissionDocument,
    task: ToolTaskDocument,
    config: { overwriteExistingSubmissions?: boolean },
  ) {
    if (config.overwriteExistingSubmissions) {
      return true;
    }
    if (submission.isDraft || submission.status === 'draft') {
      return true;
    }
    const metadata = submission.aiReviewMetadata as
      | Record<string, unknown>
      | null
      | undefined;
    return (
      metadata?.source === 'teacher_tools' && metadata?.toolTaskId === task.id
    );
  }

  private readScoreForTask(task: ToolTaskDocument, item: Record<string, unknown>) {
    const rawScore =
      task.type === 'objective_grading' ? item.totalScore : item.score;
    const score = Number(rawScore);
    return Number.isFinite(score) ? score : 0;
  }

  private buildSubmissionContent(
    task: ToolTaskDocument,
    item: Record<string, unknown>,
  ) {
    if (task.type === 'essay_batch') {
      return this.plainTextToHtml(
        String(item.essayText || '作文图片已由教师工具箱识别并同步。'),
      );
    }

    const answers = item.answers && typeof item.answers === 'object'
      ? Object.entries(item.answers as Record<string, unknown>)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([questionId, answer]) => `${questionId}.${answer || '空'}`)
          .join(' ')
      : '';
    return [
      '<p>由教师工具箱客观题批分任务同步。</p>',
      `<p>来源文件：${this.escapeHtml(String(item.fileName || ''))}</p>`,
      `<p>识别答案：${this.escapeHtml(answers || '无')}</p>`,
    ].join('');
  }

  private buildSubmissionReview(
    task: ToolTaskDocument,
    item: Record<string, unknown>,
  ) {
    if (task.type === 'essay_batch') {
      const suggestions = Array.isArray(item.suggestions)
        ? item.suggestions
            .map((suggestion, index) => {
              const row = suggestion as Record<string, unknown>;
              return [
                `${index + 1}. ${this.escapePlain(String(row.reason || '修改建议'))}`,
                row.original_sentence
                  ? `原句：${this.escapePlain(String(row.original_sentence))}`
                  : '',
                row.revised_sentence
                  ? `建议：${this.escapePlain(String(row.revised_sentence))}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n');
            })
            .join('\n\n')
        : '';
      return [
        '**批量作文检查结果**',
        `分数：${this.readScoreForTask(task, item)}`,
        item.summaryComment ? `总评：${this.escapePlain(String(item.summaryComment))}` : '',
        item.strengths ? `优点：${this.escapePlain(String(item.strengths))}` : '',
        item.weaknesses ? `问题：${this.escapePlain(String(item.weaknesses))}` : '',
        suggestions ? `修改建议：\n${suggestions}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    const grading = item.grading && typeof item.grading === 'object'
      ? (item.grading as Record<string, Record<string, unknown>>)
      : {};
    const wrongItems = Object.entries(grading)
      .filter(([, result]) => !result.isCorrect)
      .map(
        ([questionId, result]) =>
          `${questionId}：学生答案 ${result.studentAnswer ?? '空'}，标准答案 ${result.standardAnswer ?? ''}`,
      );
    return [
      '**客观题批分结果**',
      `总分：${this.readScoreForTask(task, item)}`,
      wrongItems.length
        ? `错题：\n${wrongItems.map((text) => `- ${this.escapePlain(text)}`).join('\n')}`
        : '全部正确或未发现错题。',
    ].join('\n\n');
  }

  private async storeFiles(files: UploadedFile[], folder: string) {
    const baseDir = join(process.cwd(), TOOL_UPLOAD_DIR, folder);
    await mkdir(baseDir, { recursive: true });

    return Promise.all(
      files.map(async (file) => {
        if (!file.mimetype?.startsWith('image/')) {
          throw new BadRequestException('Only image uploads are supported');
        }
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = join(baseDir, `${Date.now()}-${randomUUID()}-${safeName}`);
        await writeFile(filePath, file.buffer);
        return {
          originalName: file.originalname,
          path: filePath,
          mimeType: file.mimetype,
          size: file.size,
        };
      }),
    );
  }

  private async requireTaskAccess(currentUser: AuthenticatedUser, id: string) {
    this.assertTeacher(currentUser);
    const task = await this.toolTaskModel.findById(id);
    if (!task) {
      throw new NotFoundException('Tool task not found');
    }
    if (currentUser.role !== 'superadmin' && task.teacherId !== currentUser.id) {
      throw new ForbiddenException('Forbidden');
    }
    return task;
  }

  private assertTeacher(user: AuthenticatedUser) {
    if (!['teacher', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('Teacher privileges required');
    }
  }

  private parseJsonField(value: unknown, fallback: unknown) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new BadRequestException('Invalid JSON field');
    }
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readBoolean(value: unknown, fallback = false) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return !!value;
  }

  private async isTaskCancelled(id: string) {
    const task = await this.toolTaskModel.findById(id).select('status').lean();
    return task?.status === 'cancelled';
  }

  private plainTextToHtml(value: string) {
    return `<p>${this.escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapePlain(value: string) {
    return value.replace(/[<>]/g, '');
  }

  private async pushOrReplaceItem(
    task: ToolTaskDocument,
    item: Record<string, unknown>,
  ) {
    const fileName = String(item.fileName || '');
    const nextItems = (task.items || []).filter(
      (existing) => existing.fileName !== fileName,
    );
    nextItems.push(item);
    task.items = nextItems;
    await task.save();
  }

  private finishTask(task: ToolTaskDocument) {
    if (task.status === 'cancelled') {
      return;
    }
    task.status = this.resolveFinalStatus(task);
    task.completedAt = new Date();
  }

  private resolveFinalStatus(task: ToolTaskDocument): ToolTaskStatus {
    if (task.successCount > 0 && task.failureCount > 0) {
      return 'partial_failed';
    }
    if (task.failureCount > 0 && task.successCount === 0) {
      return 'failed';
    }
    return 'completed';
  }

  private buildObjectiveSummary(items: Array<Record<string, unknown>>) {
    const scores = items
      .map((item) => Number(item.totalScore))
      .filter((score) => Number.isFinite(score));
    return {
      ...this.buildScoreSummary(scores),
      ...this.buildSyncSummary(items),
    };
  }

  private buildEssaySummary(items: Array<Record<string, unknown>>) {
    const scores = items
      .map((item) => Number(item.score))
      .filter((score) => Number.isFinite(score));
    return {
      ...this.buildScoreSummary(scores),
      ...this.buildSyncSummary(items),
    };
  }

  private buildScoreSummary(scores: number[]) {
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    return {
      scoredCount: scores.length,
      averageScore: scores.length
        ? Number((totalScore / scores.length).toFixed(2))
        : 0,
      maxScore: scores.length ? Math.max(...scores) : 0,
      minScore: scores.length ? Math.min(...scores) : 0,
    };
  }

  private buildSyncSummary(items: Array<Record<string, unknown>>) {
    const syncItems = items
      .map((item) => item.submissionSync as Record<string, unknown> | undefined)
      .filter((item): item is Record<string, unknown> => !!item);
    return {
      syncedSubmissions: syncItems.filter((item) =>
        ['created', 'updated'].includes(String(item.status)),
      ).length,
      skippedSubmissionSyncs: syncItems.filter(
        (item) => item.status === 'skipped',
      ).length,
      failedSubmissionSyncs: syncItems.filter((item) => item.status === 'failed')
        .length,
    };
  }

  private clampScore(score: unknown) {
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) {
      return 0;
    }
    return Math.max(0, Math.min(100, numericScore));
  }

  private buildCsv(task: ToolTaskDocument) {
    const headers =
      task.type === 'objective_grading'
        ? [
            '文件名',
            '学生姓名',
            '学号',
            '关联作业',
            '匹配状态',
            '总分',
            '状态',
            '同步状态',
            '提交记录ID',
            '错误',
          ]
        : [
            '文件名',
            '学生姓名',
            '学号',
            '关联作业',
            '匹配状态',
            '分数',
            '状态',
            '同步状态',
            '提交记录ID',
            '总评',
            '错误',
          ];
    const rows = (task.items || []).map((item) => {
      const matched = item.matchedStudent as Record<string, unknown> | undefined;
      const sync = item.submissionSync as Record<string, unknown> | undefined;
      const syncText = sync
        ? [sync.status, sync.reason].filter(Boolean).join(':')
        : '';
      return task.type === 'objective_grading'
        ? [
            item.fileName,
            item.studentName,
            item.studentNumber,
            task.assignmentTitle,
            matched?.status,
            item.totalScore,
            item.status,
            syncText,
            sync?.submissionId,
            item.error,
          ]
        : [
            item.fileName,
            item.studentName,
            item.studentNumber,
            task.assignmentTitle,
            matched?.status,
            item.score,
            item.status,
            syncText,
            sync?.submissionId,
            item.summaryComment,
            item.error,
          ];
    });

    return `\uFEFF${[headers, ...rows]
      .map((row) => row.map((cell) => this.escapeCsv(cell)).join(','))
      .join('\n')}`;
  }

  private escapeCsv(value: unknown) {
    const text = value === undefined || value === null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  private toTaskPayload(
    item: ToolTaskDocument | (ToolTask & { _id?: { toString(): string } }),
  ) {
    const id = item._id?.toString?.() || '';
    return {
      id,
      _id: id,
      type: item.type,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      classId: item.classId,
      className: item.className,
      assignmentId: item.assignmentId,
      assignmentTitle: item.assignmentTitle,
      title: item.title,
      status: item.status,
      totalCount: item.totalCount,
      processedCount: item.processedCount,
      successCount: item.successCount,
      failureCount: item.failureCount,
      config: item.config,
      items: item.items || [],
      resultSummary: item.resultSummary || {},
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
