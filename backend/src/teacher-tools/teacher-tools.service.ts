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
    private readonly appService: AppService,
    private readonly doubaoVisionService: DoubaoVisionService,
    private readonly objectiveGradingService: ObjectiveGradingService,
    @Optional()
    private readonly queueService?: TeacherToolsQueueService,
  ) {}

  async parseStandardAnswers(text: string) {
    const result = await this.doubaoVisionService.parseStandardAnswers(text);
    const standardAnswers = this.objectiveGradingService.normalizeStandardAnswers(
      result.data,
    );
    return this.appService.envelope({ standardAnswers }, 'success');
  }

  async parseScoreConfig(text: string) {
    const result = await this.doubaoVisionService.parseScoreConfig(text);
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
    const classInfo = await this.resolveClass(currentUser, body.classId);
    const storedFiles = await this.storeFiles(files, 'objective-grading');
    const task = await this.toolTaskModel.create({
      type: 'objective_grading',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
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

    const classInfo = await this.resolveClass(currentUser, body.classId);
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
      if (task.status === 'cancelled') return;
      const itemBase = {
        fileName: file.originalName,
        filePath: file.path,
        status: 'processing',
      };
      await this.pushOrReplaceItem(task, itemBase);

      try {
        const recognized = await this.doubaoVisionService.recognizeAnswerCard(
          file,
        );
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

        await this.pushOrReplaceItem(task, {
          ...itemBase,
          status: 'completed',
          studentName: recognized.data.studentName || '',
          studentNumber: recognized.data.studentNumber || '',
          matchedStudent,
          answers: recognized.data.answers || {},
          grading,
          totalScore,
          rawContent: recognized.rawContent,
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
      );
      requirementsText = preview.data.requirements || '';
      task.config = { ...task.config, requirementText: requirementsText };
      await task.save();
    }

    for (const file of essayImages) {
      if (task.status === 'cancelled') return;
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
        });
        const score = this.clampScore(reviewed.data.score);
        const matchedStudent = await this.matchStudent(task.classId, {
          studentName: reviewed.data.studentName,
          studentNumber: reviewed.data.studentNumber,
        });

        await this.pushOrReplaceItem(task, {
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
    return this.buildScoreSummary(scores);
  }

  private buildEssaySummary(items: Array<Record<string, unknown>>) {
    const scores = items
      .map((item) => Number(item.score))
      .filter((score) => Number.isFinite(score));
    return this.buildScoreSummary(scores);
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
        ? ['文件名', '学生姓名', '学号', '匹配状态', '总分', '状态', '错误']
        : ['文件名', '学生姓名', '学号', '匹配状态', '分数', '状态', '总评', '错误'];
    const rows = (task.items || []).map((item) => {
      const matched = item.matchedStudent as Record<string, unknown> | undefined;
      return task.type === 'objective_grading'
        ? [
            item.fileName,
            item.studentName,
            item.studentNumber,
            matched?.status,
            item.totalScore,
            item.status,
            item.error,
          ]
        : [
            item.fileName,
            item.studentName,
            item.studentNumber,
            matched?.status,
            item.score,
            item.status,
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

