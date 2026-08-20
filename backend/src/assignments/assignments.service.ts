import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import {
  Submission,
  SubmissionDocument,
} from '../submissions/schemas/submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AssignmentStudentsQueryDto } from './dto/assignment-students-query.dto';
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
const ALLOWED_ASSIGNMENT_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'startDate',
  'endDate',
  'title',
  'status',
  'teacherName',
]);
type DocumentIdentifier = string | { toString(): string };
type AssignmentSource = Pick<
  Assignment,
  | 'title'
  | 'description'
  | 'teacherId'
  | 'teacherName'
  | 'classes'
  | 'aiRule'
  | 'questionMaterial'
  | 'referenceAnswer'
  | 'assignmentType'
  | 'onlineQuestions'
  | 'gradingNotes'
  | 'submissionFormat'
  | 'startDate'
  | 'endDate'
  | 'allowAttachments'
  | 'status'
  | 'terminatedReason'
> & {
  _id?: DocumentIdentifier;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
type AssignmentStats = {
  total: number;
  submitted: number;
  graded: number;
  pending: number;
  totalStudents: number;
  totalSubmissions: number;
  reviewedSubmissions: number;
  pendingSubmissions: number;
  draftSubmissions: number;
};
type AssignmentStudentStatus = NormalizedSubmissionStatus | 'not_submitted';
type AssignmentStudentRow = {
  _id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classId: string;
  className: string;
  status: AssignmentStudentStatus;
  submittedAt: Date | null | undefined;
  content: string;
  contentPreview: string;
  wordCount: number;
  aiScore: number | null;
  teacherScore: number | null;
  teacherReviewedAt: Date | null | undefined;
  teacherName: string;
};
type AssignmentAnalyticsQuestion = {
  questionId: string;
  questionNumber: number;
  type: string;
  stem: string;
  maxScore: number;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  wrongRate: number;
  commonWrongAnswers: Array<{
    answer: string;
    count: number;
  }>;
};
type AssignmentAnalyticsClassStat = {
  classId: string;
  className: string;
  totalStudents: number;
  submittedCount: number;
  submissionRate: number;
  averageScore: number | null;
};
type AssignmentAnalyticsSummary = {
  completionSummary: string;
  scoreSummary: string;
  weakPoints: string[];
  teachingSuggestions: string[];
};
type StudentAssignmentListItem = {
  id: string;
  title: string;
  teacherName: string;
  startDate: Date;
  endDate: Date;
  status: Assignment['status'];
  terminatedReason?: string;
  isExpired: boolean;
  hasSubmitted: boolean;
  hasDraft: boolean;
  submissionStatus?: NormalizedSubmissionStatus;
  submissionId?: string;
  allowAttachments: boolean;
  assignmentType?: Assignment['assignmentType'];
  createdAt?: Date;
  classId: string;
  className: string;
};

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
    private readonly appService: AppService,
  ) {}

  async listAssignments(
    currentUser: AuthenticatedUser,
    query: AssignmentQueryDto,
  ) {
    this.assertTeacherPrivileges(currentUser);

    const filter = this.buildTeacherAssignmentFilter(currentUser, query);
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const skip = (page - 1) * pageSize;
    const requestedSortField = query.sort || query.sortBy || 'createdAt';
    const sortField = ALLOWED_ASSIGNMENT_SORT_FIELDS.has(requestedSortField)
      ? requestedSortField
      : 'createdAt';
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
      'success',
    );
  }

  async getAssignment(currentUser: AuthenticatedUser, id: string) {
    this.assertTeacherPrivileges(currentUser);

    const item = await this.assignmentModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('Assignment not found');
    }

    this.assertCanManageAssignment(currentUser, item.teacherId);
    const stats = await this.getAssignmentStats(item);

    return this.appService.envelope(
      this.toAssignmentDetail(item, stats),
      'success',
    );
  }

  async getAssignmentStudents(
    currentUser: AuthenticatedUser,
    id: string,
    query?: AssignmentStudentsQueryDto,
  ) {
    this.assertTeacherPrivileges(currentUser);

    const assignment = await this.assignmentModel.findById(id).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    this.assertCanManageAssignment(currentUser, assignment.teacherId);

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
      membershipFilter.studentName = {
        $regex: query.studentName,
        $options: 'i',
      };
    }
    if (query?.studentNumber) {
      membershipFilter.studentNumber = {
        $regex: query.studentNumber,
        $options: 'i',
      };
    }

    const memberships = await this.membershipModel
      .find(membershipFilter)
      .lean();
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

    const submissionMap = new Map(
      submissions.map((item) => [item.studentId, item]),
    );
    let rows: AssignmentStudentRow[] = memberships.map((member) => {
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
          assignment.classes.find((item) => item.id === member.classId)?.name ||
          '',
        status: normalizedStatus,
        submittedAt: submission?.submittedAt || null,
        content: submission?.content || '',
        contentPreview: submission?.content
          ? this.getContentPreview(submission.content)
          : '',
        wordCount: submission?.content
          ? this.getWordCount(submission.content)
          : 0,
        aiScore: submission?.aiScore ?? null,
        teacherScore: submission?.teacherScore ?? null,
        teacherReviewedAt: submission?.teacherReviewedAt || null,
        teacherName: submission ? assignment.teacherName : '',
      };
    });

    rows = rows.filter((row) => {
      const hasSubmission = row.status !== 'not_submitted';
      const isDraft = row.status === 'draft';

      if (
        query?.submissionStatus === 'submitted' &&
        (!hasSubmission || isDraft)
      ) {
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
      'success',
    );
  }

  async getAssignmentAnalytics(currentUser: AuthenticatedUser, id: string) {
    this.assertTeacherPrivileges(currentUser);

    const assignment = await this.assignmentModel.findById(id).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    this.assertCanManageAssignment(currentUser, assignment.teacherId);

    const classIds = assignment.classes.map((item) => item.id);
    const [memberships, submissions] = await Promise.all([
      this.membershipModel
        .find({
          classId: { $in: classIds },
          status: 'active',
        })
        .lean(),
      this.submissionModel
        .find({
          assignmentId: id,
          classId: { $in: classIds },
        })
        .lean(),
    ]);

    const nonDraftSubmissions = submissions.filter((item) => !item.isDraft);
    const totalStudentIds = new Set(memberships.map((item) => item.studentId));
    const submittedStudentIds = new Set(
      nonDraftSubmissions.map((item) => item.studentId),
    );
    const scoredSubmissions = nonDraftSubmissions.filter(
      (item) => this.getEffectiveScore(item) !== null,
    );
    const scores = scoredSubmissions.map((item) => this.getEffectiveScore(item) || 0);
    const averageScore = scores.length
      ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
      : null;

    const classStats = assignment.classes.map<AssignmentAnalyticsClassStat>(
      (classItem) => {
        const classMembers = memberships.filter(
          (member) => member.classId === classItem.id,
        );
        const classSubmissions = nonDraftSubmissions.filter(
          (submission) => submission.classId === classItem.id,
        );
        const classScores = classSubmissions
          .map((submission) => this.getEffectiveScore(submission))
          .filter((score): score is number => score !== null);

        return {
          classId: classItem.id,
          className: classItem.name,
          totalStudents: classMembers.length,
          submittedCount: classSubmissions.length,
          submissionRate: this.toPercent(
            classSubmissions.length,
            classMembers.length,
          ),
          averageScore: classScores.length
            ? Math.round(
                (classScores.reduce((sum, score) => sum + score, 0) /
                  classScores.length) *
                  10,
              ) / 10
            : null,
        };
      },
    );

    const wrongQuestionDistribution =
      this.buildWrongQuestionDistribution(nonDraftSubmissions);
    const scoreBands = this.buildScoreBands(scores);
    const summary = this.buildAssignmentAnalyticsSummary({
      totalStudents: totalStudentIds.size,
      submittedCount: submittedStudentIds.size,
      scoredCount: scoredSubmissions.length,
      averageScore,
      wrongQuestionDistribution,
      assignmentType: assignment.assignmentType || 'normal',
    });

    return this.appService.envelope(
      {
        assignmentId: id,
        assignmentTitle: assignment.title,
        assignmentType: assignment.assignmentType || 'normal',
        totalStudents: totalStudentIds.size,
        submittedCount: submittedStudentIds.size,
        unsubmittedCount: Math.max(
          totalStudentIds.size - submittedStudentIds.size,
          0,
        ),
        gradedCount: scoredSubmissions.length,
        submissionRate: this.toPercent(
          submittedStudentIds.size,
          totalStudentIds.size,
        ),
        averageScore,
        scoreBands,
        classStats,
        wrongQuestionDistribution,
        summary,
        generatedAt: new Date().toISOString(),
      },
      'success',
    );
  }

  async createAssignment(
    currentUser: AuthenticatedUser,
    payload: CreateAssignmentDto,
  ) {
    this.assertTeacherPrivileges(currentUser);

    const classes = await this.resolveAssignmentClasses(
      currentUser,
      payload.classes,
    );
    const item = await this.assignmentModel.create({
      title: payload.title,
      description: payload.description,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      classes,
      aiRule: payload.aiRule || null,
      questionMaterial: payload.questionMaterial || null,
      referenceAnswer: payload.referenceAnswer || null,
      assignmentType: payload.assignmentType || 'normal',
      onlineQuestions: this.normalizeOnlineQuestions(payload),
      gradingNotes: payload.gradingNotes || '',
      submissionFormat: payload.submissionFormat || 'answers_only',
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      allowAttachments:
        payload.submissionFormat === 'answer_sheet' ||
        !!payload.allowAttachments,
      status: 'draft',
    });

    const stats = await this.getAssignmentStats(item.toObject());
    return this.appService.envelope(
      this.toAssignmentDetail(item.toObject(), stats),
      'success',
    );
  }

  async updateAssignment(
    currentUser: AuthenticatedUser,
    id: string,
    payload: UpdateAssignmentDto,
  ) {
    this.assertTeacherPrivileges(currentUser);

    const item = await this.assignmentModel.findById(id);
    if (!item) {
      throw new NotFoundException('Assignment not found');
    }

    this.assertCanManageAssignment(currentUser, item.teacherId);

    if (payload.classes) {
      item.classes = await this.resolveAssignmentClasses(
        currentUser,
        payload.classes,
      );
    }

    if (payload.title !== undefined) item.title = payload.title;
    if (payload.description !== undefined)
      item.description = payload.description;
    if (payload.aiRule !== undefined) item.aiRule = payload.aiRule;
    if (payload.questionMaterial !== undefined)
      item.questionMaterial = payload.questionMaterial;
    if (payload.referenceAnswer !== undefined)
      item.referenceAnswer = payload.referenceAnswer;
    if (payload.assignmentType !== undefined)
      item.assignmentType = payload.assignmentType;
    if (payload.onlineQuestions !== undefined || payload.assignmentType !== undefined)
      item.onlineQuestions = this.normalizeOnlineQuestions({
        assignmentType: payload.assignmentType || item.assignmentType,
        onlineQuestions: payload.onlineQuestions ?? item.onlineQuestions,
      });
    if (payload.gradingNotes !== undefined)
      item.gradingNotes = payload.gradingNotes;
    if (payload.submissionFormat !== undefined)
      item.submissionFormat = payload.submissionFormat;
    if (payload.startDate !== undefined)
      item.startDate = new Date(payload.startDate);
    if (payload.endDate !== undefined) item.endDate = new Date(payload.endDate);
    if (payload.allowAttachments !== undefined)
      item.allowAttachments = payload.allowAttachments;
    if (item.submissionFormat === 'answer_sheet') {
      item.allowAttachments = true;
    }

    await item.save();
    const stats = await this.getAssignmentStats(item.toObject());
    return this.appService.envelope(
      this.toAssignmentDetail(item.toObject(), stats),
      'success',
    );
  }

  async updateAssignmentStatus(
    currentUser: AuthenticatedUser,
    id: string,
    payload: UpdateAssignmentStatusDto,
  ) {
    this.assertTeacherPrivileges(currentUser);

    const item = await this.assignmentModel.findById(id);
    if (!item) {
      throw new NotFoundException('Assignment not found');
    }

    this.assertCanManageAssignment(currentUser, item.teacherId);
    item.status = payload.status;
    item.terminatedReason =
      payload.status === 'terminated' ? payload.terminatedReason : undefined;
    await item.save();

    const stats = await this.getAssignmentStats(item.toObject());
    return this.appService.envelope(
      this.toAssignmentDetail(item.toObject(), stats),
      'success',
    );
  }

  async deleteAssignment(currentUser: AuthenticatedUser, id: string) {
    this.assertTeacherPrivileges(currentUser);

    const item = await this.assignmentModel.findById(id).lean();
    if (!item) {
      throw new NotFoundException('Assignment not found');
    }

    this.assertCanManageAssignment(currentUser, item.teacherId);

    await Promise.all([
      this.assignmentModel.findByIdAndDelete(id),
      this.submissionModel.deleteMany({ assignmentId: id }),
    ]);

    return this.appService.envelope(null, 'success');
  }

  async getStudentAssignments(
    currentUser: AuthenticatedUser,
    query?: AssignmentQueryDto,
  ) {
    if (currentUser.role !== 'student') {
      throw new ForbiddenException(
        'Only students can access student assignments',
      );
    }

    const memberships = await this.membershipModel
      .find({ studentId: currentUser.id, status: 'active' })
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
        'success',
      );
    }

    const filter = this.buildStudentAssignmentFilter(classIds, query);
    const requestedSortField = query?.sort || query?.sortBy || 'createdAt';
    const sortField = ALLOWED_ASSIGNMENT_SORT_FIELDS.has(requestedSortField)
      ? requestedSortField
      : 'createdAt';
    const sortOrder = (query?.order || query?.sortOrder) === 'asc' ? 1 : -1;
    const assignments = await this.assignmentModel
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .lean();
    const submissions = await this.submissionModel
      .find({
        assignmentId: { $in: assignments.map((item) => item._id.toString()) },
        studentId: currentUser.id,
      })
      .lean();
    const submissionMap = new Map(
      submissions.map((item) => [item.assignmentId, item]),
    );

    let items: StudentAssignmentListItem[] = assignments.map((item) => {
      const availableClasses = item.classes.filter((cls) =>
        classIds.includes(cls.id),
      );
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
        assignmentType: item.assignmentType || 'normal',
        createdAt: item.createdAt,
        classId: matchedClass?.id || currentUser.classId || '',
        className: matchedClass?.name || currentUser.className || '',
      };
    });

    items = items.filter((item) => {
      if (query?.businessStatus === 'todo') {
        return (
          item.status === 'published' && !item.isExpired && !item.hasSubmitted
        );
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
      'success',
    );
  }

  async getStudentAssignmentStatistics(currentUser: AuthenticatedUser) {
    const response = await this.getStudentAssignments(currentUser, {
      page: 1,
      pageSize: 1000,
    });
    const items = response.data.items;

    return this.appService.envelope(
      {
        totalAssignments: items.length,
        submittedCount: items.filter((item) => item.hasSubmitted).length,
        todoCount: items.filter(
          (item) =>
            item.status === 'published' &&
            !item.isExpired &&
            !item.hasSubmitted,
        ).length,
        draftCount: items.filter((item) => item.hasDraft).length,
        expiredCount: items.filter((item) => item.isExpired).length,
        reviewedCount: items.filter(
          (item) => item.submissionStatus === 'teacher_reviewed',
        ).length,
      },
      'success',
    );
  }

  async getStudentAssignment(
    currentUser: AuthenticatedUser,
    assignmentId: string,
    classId?: string,
  ) {
    if (currentUser.role !== 'student') {
      throw new ForbiddenException(
        'Only students can access student assignments',
      );
    }

    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.status === 'draft') {
      throw new ForbiddenException(
        'Draft assignments are not visible to students',
      );
    }

    const memberships = await this.membershipModel
      .find({
        studentId: currentUser.id,
        classId: { $in: assignment.classes.map((item) => item.id) },
        status: 'active',
      })
      .lean();

    if (!memberships.length) {
      throw new ForbiddenException(
        'Student is not in any class for this assignment',
      );
    }

    const availableClassIds = memberships.map((item) => item.classId);
    if (classId && !availableClassIds.includes(classId)) {
      throw new ForbiddenException('Student is not in the requested class');
    }
    const resolvedClassId =
      classId && availableClassIds.includes(classId)
        ? classId
        : availableClassIds[0];
    const matchedClass = assignment.classes.find(
      (item) => item.id === resolvedClassId,
    );

    const submission = await this.submissionModel
      .findOne({ assignmentId, studentId: currentUser.id })
      .lean();
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
        (submission.status !== 'teacher_reviewed' &&
          (submission.submissionCount || 0) < 2));

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
        className: matchedClass?.name || currentUser.className,
        aiRule: assignment.aiRule,
        questionMaterial: assignment.questionMaterial,
        assignmentType: assignment.assignmentType || 'normal',
        onlineQuestions: this.toStudentOnlineQuestions(
          assignment.onlineQuestions || [],
        ),
        gradingNotes: assignment.gradingNotes,
        submissionFormat: assignment.submissionFormat,
      },
      'success',
    );
  }

  private buildTeacherAssignmentFilter(
    user: AuthenticatedUser,
    query: AssignmentQueryDto,
  ) {
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
      filter.endDate = {
        ...(filter.endDate as Record<string, Date>),
        $lt: new Date(),
      };
    } else if (query.isExpired === false) {
      filter.endDate = {
        ...(filter.endDate as Record<string, Date>),
        $gte: new Date(),
      };
    }

    return filter;
  }

  private buildStudentAssignmentFilter(
    classIds: string[],
    query?: AssignmentQueryDto,
  ) {
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
      filter.endDate = {
        ...(filter.endDate as Record<string, Date>),
        $lt: new Date(),
      };
    } else if (query?.isExpired === false) {
      filter.endDate = {
        ...(filter.endDate as Record<string, Date>),
        $gte: new Date(),
      };
    }

    return filter;
  }

  private async resolveAssignmentClasses(
    user: AuthenticatedUser,
    classIds: string[],
  ) {
    const uniqueClassIds = [...new Set(classIds || [])];
    if (!uniqueClassIds.length) {
      throw new BadRequestException('At least one class is required');
    }

    const classes = await this.classModel
      .find({ _id: { $in: uniqueClassIds } })
      .lean();
    if (classes.length !== uniqueClassIds.length) {
      throw new BadRequestException('One or more classes are invalid');
    }

    if (user.role !== 'superadmin') {
      const invalidClass = classes.find((item) => item.teacherId !== user.id);
      if (invalidClass) {
        throw new ForbiddenException(
          'Teachers can only assign to their own classes',
        );
      }
    }

    return classes.map((item) => ({
      id: item._id.toString(),
      name: item.name,
    }));
  }

  private normalizeOnlineQuestions(payload: {
    assignmentType?: Assignment['assignmentType'];
    onlineQuestions?: Array<Record<string, unknown>> | Assignment['onlineQuestions'];
  }) {
    if (payload.assignmentType !== 'online') {
      return [];
    }

    const questions = Array.isArray(payload.onlineQuestions)
      ? payload.onlineQuestions
      : [];
    if (!questions.length) {
      throw new BadRequestException('Online assignments require questions');
    }

    return questions.map((question, index) => {
      const source = question as Record<string, unknown>;
      const type = source.type;
      const stem = String(source.stem || '').trim();
      const answer = String(source.answer || '').trim();
      const score = Number(source.score ?? 1);
      const options = Array.isArray(source.options)
        ? source.options.map((item) => String(item).trim()).filter(Boolean)
        : [];

      if (type !== 'single_choice' && type !== 'fill_blank') {
        throw new BadRequestException(`Question ${index + 1} type is invalid`);
      }
      const questionType = type as 'single_choice' | 'fill_blank';
      if (!stem) {
        throw new BadRequestException(`Question ${index + 1} stem is required`);
      }
      if (!answer) {
        throw new BadRequestException(`Question ${index + 1} answer is required`);
      }
      if (!Number.isFinite(score) || score <= 0) {
        throw new BadRequestException(`Question ${index + 1} score is invalid`);
      }
      if (type === 'single_choice') {
        if (options.length < 2) {
          throw new BadRequestException(
            `Question ${index + 1} needs at least two options`,
          );
        }
        if (!options.includes(answer)) {
          throw new BadRequestException(
            `Question ${index + 1} answer must match one option exactly`,
          );
        }
      }

      return {
        id: String(source.id || `q-${index + 1}`),
        type: questionType,
        stem,
        options: questionType === 'single_choice' ? options : [],
        answer,
        score,
      };
    });
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

  private readEntityId(item: { _id?: DocumentIdentifier; id?: string }) {
    return item._id?.toString?.() || item.id || '';
  }

  private async getAssignmentStats(
    item: AssignmentSource,
  ): Promise<AssignmentStats> {
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
      this.submissionModel
        .find({ assignmentId: this.readEntityId(item) })
        .lean(),
    ]);

    const nonDraftSubmissions = submissions.filter(
      (submission) => !submission.isDraft,
    );
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
      (submission) =>
        this.normalizeSubmissionStatus(submission.status) === 'submitted',
    );
    const draftSubmissions = submissions.filter(
      (submission) => submission.isDraft,
    ).length;

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

  private getEffectiveScore(item: {
    teacherScore?: number | null;
    aiScore?: number | null;
  }) {
    if (typeof item.teacherScore === 'number') return item.teacherScore;
    if (typeof item.aiScore === 'number') return item.aiScore;
    return null;
  }

  private toPercent(value: number, total: number) {
    if (!total) return 0;
    return Math.round((value / total) * 1000) / 10;
  }

  private buildScoreBands(scores: number[]) {
    const bands = [
      { label: '90-100', min: 90, max: 100, count: 0 },
      { label: '80-89', min: 80, max: 89, count: 0 },
      { label: '70-79', min: 70, max: 79, count: 0 },
      { label: '60-69', min: 60, max: 69, count: 0 },
      { label: '0-59', min: 0, max: 59, count: 0 },
    ];

    scores.forEach((rawScore) => {
      const score = Math.max(0, Math.min(100, rawScore));
      const band = bands.find(
        (item) => score >= item.min && score <= item.max,
      );
      if (band) band.count += 1;
    });

    return bands.map((item) => ({
      ...item,
      rate: this.toPercent(item.count, scores.length),
    }));
  }

  private buildWrongQuestionDistribution(
    submissions: Array<{
      objectiveResult?: Record<string, unknown> | null;
      aiReviewMetadata?: Record<string, unknown> | null;
    }>,
  ): AssignmentAnalyticsQuestion[] {
    const questionMap = new Map<
      string,
      AssignmentAnalyticsQuestion & {
        wrongAnswerMap: Map<string, number>;
      }
    >();

    submissions.forEach((submission) => {
      const details = this.readObjectiveDetails(submission);
      details.forEach((detail) => {
        const questionId = String(detail.questionId || '');
        if (!questionId) return;

        const existing = questionMap.get(questionId) || {
          questionId,
          questionNumber: Number(detail.questionNumber || 0),
          type: String(detail.type || ''),
          stem: String(detail.stem || ''),
          maxScore: Number(detail.maxScore || 0),
          totalAnswered: 0,
          correctCount: 0,
          wrongCount: 0,
          wrongRate: 0,
          commonWrongAnswers: [],
          wrongAnswerMap: new Map<string, number>(),
        };

        existing.totalAnswered += 1;
        if (detail.isCorrect === true) {
          existing.correctCount += 1;
        } else {
          existing.wrongCount += 1;
          const answer = String(detail.studentAnswer ?? '').trim() || '未作答';
          existing.wrongAnswerMap.set(
            answer,
            (existing.wrongAnswerMap.get(answer) || 0) + 1,
          );
        }

        questionMap.set(questionId, existing);
      });
    });

    return Array.from(questionMap.values())
      .map((item) => ({
        questionId: item.questionId,
        questionNumber: item.questionNumber,
        type: item.type,
        stem: item.stem,
        maxScore: item.maxScore,
        totalAnswered: item.totalAnswered,
        correctCount: item.correctCount,
        wrongCount: item.wrongCount,
        wrongRate: this.toPercent(item.wrongCount, item.totalAnswered),
        commonWrongAnswers: Array.from(item.wrongAnswerMap.entries())
          .map(([answer, count]) => ({ answer, count }))
          .sort((left, right) => right.count - left.count)
          .slice(0, 3),
      }))
      .sort((left, right) => {
        if (right.wrongRate !== left.wrongRate) {
          return right.wrongRate - left.wrongRate;
        }
        return right.wrongCount - left.wrongCount;
      });
  }

  private readObjectiveDetails(submission: {
    objectiveResult?: Record<string, unknown> | null;
    aiReviewMetadata?: Record<string, unknown> | null;
  }) {
    const directDetails = submission.objectiveResult?.details;
    if (Array.isArray(directDetails)) {
      return directDetails as Array<Record<string, unknown>>;
    }

    const metadataResult = submission.aiReviewMetadata?.objectiveResult;
    if (
      metadataResult &&
      typeof metadataResult === 'object' &&
      Array.isArray((metadataResult as Record<string, unknown>).details)
    ) {
      return (metadataResult as Record<string, unknown>).details as Array<
        Record<string, unknown>
      >;
    }

    return [];
  }

  private buildAssignmentAnalyticsSummary(input: {
    totalStudents: number;
    submittedCount: number;
    scoredCount: number;
    averageScore: number | null;
    wrongQuestionDistribution: AssignmentAnalyticsQuestion[];
    assignmentType: Assignment['assignmentType'];
  }): AssignmentAnalyticsSummary {
    const submissionRate = this.toPercent(
      input.submittedCount,
      input.totalStudents,
    );
    const completionSummary = `本次作业共 ${input.totalStudents} 名学生，已提交 ${input.submittedCount} 人，提交率 ${submissionRate}%。`;
    const scoreSummary =
      input.averageScore === null
        ? '当前暂无可统计的批改成绩，建议先完成 AI 批改或教师批改。'
        : `已统计 ${input.scoredCount} 份成绩，平均分 ${input.averageScore} 分。`;
    const topWrongQuestions = input.wrongQuestionDistribution.slice(0, 5);
    const weakPoints: string[] = [];

    if (topWrongQuestions.length > 0) {
      // 添加总体薄弱点概述
      const highErrorQuestions = topWrongQuestions.filter((q) => q.wrongRate >= 50);
      const mediumErrorQuestions = topWrongQuestions.filter(
        (q) => q.wrongRate >= 30 && q.wrongRate < 50,
      );

      if (highErrorQuestions.length > 0) {
        weakPoints.push(
          `有 ${highErrorQuestions.length} 道题错误率超过 50%，属于严重薄弱点，需要重点关注。`,
        );
      }
      if (mediumErrorQuestions.length > 0) {
        weakPoints.push(
          `有 ${mediumErrorQuestions.length} 道题错误率在 30%-50% 之间，属于中等薄弱点。`,
        );
      }

      // 逐题分析薄弱点
      topWrongQuestions.forEach((item, index) => {
        const severity =
          item.wrongRate >= 50 ? '严重' : item.wrongRate >= 30 ? '中等' : '一般';
        const stemPreview = item.stem.length > 20 ? item.stem.slice(0, 20) + '...' : item.stem;
        weakPoints.push(
          `第 ${item.questionNumber || '-'} 题（${stemPreview}）错误率 ${item.wrongRate}%，` +
            `属于${severity}薄弱点，${item.wrongCount} 人答错。`,
        );
      });

      // 添加常见错误分析
      topWrongQuestions.forEach((item) => {
        if (item.commonWrongAnswers && item.commonWrongAnswers.length > 0) {
          const topWrongAnswer = item.commonWrongAnswers[0];
          weakPoints.push(
            `第 ${item.questionNumber || '-'} 题最常见错误答案为"${topWrongAnswer.answer}"，` +
              `有 ${topWrongAnswer.count} 人选择，可能存在概念性误解。`,
          );
        }
      });
    } else {
      weakPoints.push(
        input.assignmentType === 'online'
          ? '暂未发现集中错题，建议结合学生反馈复核易混题。'
          : '普通作业暂无结构化错题数据，可结合 AI 评语或后续增加题号标注提升分析精度。',
      );
    }
    const teachingSuggestions = [
      submissionRate < 80
        ? '先跟进未提交学生，确保讲评前样本足够完整。'
        : '提交覆盖较好，可以进入集中讲评和分层巩固。',
      input.averageScore !== null && input.averageScore < 70
        ? '平均分偏低，建议安排基础概念回讲和同类题再练。'
        : '可针对高频错题做短讲，再用变式题快速检测掌握情况。',
      topWrongQuestions.length
        ? '优先讲解错误率最高的 1-3 道题，并展示常见错误答案的思路偏差。'
        : '建议在后续作业中使用在线客观题或题号结构化提交，便于自动生成错题分布。',
    ];

    return {
      completionSummary,
      scoreSummary,
      weakPoints,
      teachingSuggestions,
    };
  }

  private assertTeacherPrivileges(user: AuthenticatedUser) {
    if (!['teacher', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('Teacher privileges required');
    }
  }

  private assertCanManageAssignment(
    user: AuthenticatedUser,
    teacherId: string,
  ) {
    this.assertTeacherPrivileges(user);
    if (user.role !== 'superadmin' && user.id !== teacherId) {
      throw new ForbiddenException('You can only manage your own assignments');
    }
  }

  private normalizeSubmissionStatus(
    status: string,
  ): NormalizedSubmissionStatus {
    if (status === 'ai_review_queued' || status === 'ai_review_failed') {
      return 'submitted';
    }
    return status as NormalizedSubmissionStatus;
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

  private toAssignmentListItem(item: AssignmentSource, stats: AssignmentStats) {
    return {
      id: this.readEntityId(item),
      title: item.title,
      description: item.description,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      classes: item.classes,
      aiRule: item.aiRule,
      questionMaterial: item.questionMaterial,
      referenceAnswer: item.referenceAnswer,
      assignmentType: item.assignmentType || 'normal',
      onlineQuestions:
        item.assignmentType === 'online' ? item.onlineQuestions || [] : [],
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

  private toAssignmentDetail(item: AssignmentSource, stats: AssignmentStats) {
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
