import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { Assignment, AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { Submission, SubmissionDocument } from '../submissions/schemas/submission.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly appService: AppService,
  ) {}

  async getTeacherDashboard(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException('登录失效');

    const myClasses = await this.classModel.find({ teacherId: user.id }).lean();
    const myClassIds = myClasses.map((item) => item._id.toString());
    const myAssignments = await this.assignmentModel.find({ teacherId: user.id }).lean();
    const myAssignmentIds = myAssignments.map((item) => item._id.toString());
    const memberships = await this.membershipModel.find({ classId: { $in: myClassIds } }).lean();
    const submissions = await this.submissionModel.find({ assignmentId: { $in: myAssignmentIds } }).lean();

    return this.appService.envelope(
      {
        myClasses: myClasses.length,
        myAssignments: myAssignments.length,
        pendingReviews: submissions.filter((s) => ['submitted', 'ai_reviewed'].includes(s.status)).length,
        totalStudents: memberships.length,
        classSubmissionStats: myClasses.map((cls) => {
          const totalStudents = memberships.filter((m) => m.classId === cls._id.toString()).length;
          const submittedCount = submissions.filter(
            (s) => s.classId === cls._id.toString() && !s.isDraft,
          ).length;
          return {
            classId: cls._id.toString(),
            className: cls.name,
            totalStudents,
            submittedCount,
            submissionRate: totalStudents ? Math.round((submittedCount / totalStudents) * 1000) / 10 : 0,
          };
        }),
        assignmentStatusDistribution: ['draft', 'published', 'terminated'].map((status) => ({
          status,
          count: myAssignments.filter((a) => a.status === status).length,
          percentage: myAssignments.length
            ? Math.round((myAssignments.filter((a) => a.status === status).length / myAssignments.length) * 100)
            : 0,
        })),
        aiReviewStats: {
          todayReviews: submissions.filter((s) => s.aiScore !== null && s.aiScore !== undefined).length,
          totalReviews: submissions.filter((s) => s.aiScore !== null && s.aiScore !== undefined).length,
          failedReviews: submissions.filter((s) => s.status === 'ai_review_failed').length,
          pendingReviews: submissions.filter((s) => ['submitted', 'ai_review_queued'].includes(s.status)).length,
        },
        studentScoreAnalysis: {
          avgAiScore: this.average(submissions.map((s) => s.aiScore).filter((v) => v !== null && v !== undefined) as number[]),
          avgTeacherScore: this.average(submissions.map((s) => s.teacherScore).filter((v) => v !== null && v !== undefined) as number[]),
          scoreDifference:
            this.average(submissions.map((s) => s.teacherScore).filter((v) => v !== null && v !== undefined) as number[]) -
            this.average(submissions.map((s) => s.aiScore).filter((v) => v !== null && v !== undefined) as number[]),
          excellentRate: submissions.length
            ? Math.round((submissions.filter((s) => (s.teacherScore ?? s.aiScore ?? 0) >= 90).length / submissions.length) * 100)
            : 0,
          passRate: submissions.length
            ? Math.round((submissions.filter((s) => (s.teacherScore ?? s.aiScore ?? 0) >= 60).length / submissions.length) * 100)
            : 0,
        },
      },
      '获取成功',
    );
  }

  async getTeacherPendingTasks(userId: string) {
    const assignments = await this.assignmentModel.find({ teacherId: userId }).lean();
    const assignmentIds = assignments.map((item) => item._id.toString());
    const classIds = assignments.flatMap((item) => item.classes.map((cls) => cls.id));
    const memberships = await this.membershipModel.find({ classId: { $in: classIds } }).lean();
    const submissions = await this.submissionModel.find({ assignmentId: { $in: assignmentIds } }).lean();

    return this.appService.envelope(
      {
        assignments: assignments.map((assignment) => {
          const totalStudents = memberships.filter((member) =>
            assignment.classes.some((cls) => cls.id === member.classId),
          ).length;
          const submittedCount = submissions.filter(
            (submission) => submission.assignmentId === assignment._id.toString() && !submission.isDraft,
          ).length;
          return {
            id: assignment._id.toString(),
            title: assignment.title,
            classCount: assignment.classes.length,
            submissionRate: totalStudents ? Math.round((submittedCount / totalStudents) * 100) : 0,
            status: assignment.status,
            endDate: assignment.endDate,
          };
        }),
        submissions: submissions
          .filter((submission) => ['submitted', 'ai_reviewed'].includes(submission.status))
          .sort(
            (a, b) =>
              new Date(b.submittedAt || b.createdAt || 0).getTime() -
              new Date(a.submittedAt || a.createdAt || 0).getTime(),
          )
          .map((submission) => ({
            id: submission._id.toString(),
            assignmentId: submission.assignmentId,
            studentName: submission.studentName,
            assignmentTitle:
              assignments.find((a) => a._id.toString() === submission.assignmentId)?.title || '',
            status: submission.status,
            submittedAt: submission.submittedAt || submission.createdAt,
            aiScore: submission.aiScore,
          })),
      },
      '获取成功',
    );
  }

  async getTeacherPerformanceSummary(userId: string) {
    const assignments = await this.assignmentModel.find({ teacherId: userId }).lean();
    const assignmentIds = assignments.map((item) => item._id.toString());
    const submissions = await this.submissionModel.find({ assignmentId: { $in: assignmentIds } }).lean();
    const scored = submissions.filter((item) => item.teacherScore !== null || item.aiScore !== null);

    return this.appService.envelope(
      {
        averageScore: this.average(scored.map((item) => item.teacherScore ?? item.aiScore ?? 0)),
        reviewCompletionRate: submissions.length
          ? Math.round((submissions.filter((item) => item.status === 'teacher_reviewed').length / submissions.length) * 100)
          : 0,
        aiReviewCoverage: submissions.length
          ? Math.round((submissions.filter((item) => item.aiScore !== null && item.aiScore !== undefined).length / submissions.length) * 100)
          : 0,
        assignmentCount: assignments.length,
      },
      '获取成功',
    );
  }

  async getTeacherQuickActions(userId: string) {
    const assignments = await this.assignmentModel.find({ teacherId: userId }).lean();
    const assignmentIds = assignments.map((item) => item._id.toString());
    const submissions = await this.submissionModel.find({ assignmentId: { $in: assignmentIds } }).lean();
    const firstPendingAssignment = assignments.find((assignment) =>
      submissions.some(
        (submission) =>
          submission.assignmentId === assignment._id.toString() &&
          ['submitted', 'ai_reviewed'].includes(submission.status),
      ),
    );

    return this.appService.envelope(
      [
        { key: 'classes', title: '查看班级', path: '/teacher/classes' },
        { key: 'new-assignment', title: '新建作业', path: '/teacher/assignmentsEdit' },
        {
          key: 'pending-review',
          title: '进入待批改',
          path: firstPendingAssignment
            ? `/teacher/assignments/detail?id=${firstPendingAssignment._id.toString()}&openFirstPending=true`
            : '/teacher/assignments',
        },
      ],
      '获取成功',
    );
  }

  async getStudentDashboard(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException('登录失效');

    const memberships = await this.membershipModel.find({ studentId: user.id, status: 'active' }).lean();
    const classIds = memberships.map((item) => item.classId);
    const assignments = await this.assignmentModel.find({ 'classes.id': { $in: classIds } }).lean();
    const submissions = await this.submissionModel.find({ studentId: user.id }).lean();

    const pendingAssignmentsList = assignments
      .map((assignment) => {
        const matchedClass = assignment.classes.find((cls) => classIds.includes(cls.id));
        const submission = submissions.find(
          (item) => item.assignmentId === assignment._id.toString() && item.classId === matchedClass?.id,
        );
        return {
          assignmentId: assignment._id.toString(),
          title: assignment.title,
          classId: matchedClass?.id || '',
          className: matchedClass?.name || '',
          endDate: assignment.endDate,
          hasSubmitted: !!submission && !submission.isDraft,
          hasDraft: !!submission && submission.isDraft,
          status: submission?.isDraft ? 'draft' : 'not_started',
        };
      })
      .filter((item) => !item.hasSubmitted);

    return this.appService.envelope(
      {
        completedSubmissions: submissions.filter((item) => !item.isDraft).length,
        averageScore: this.average(
          submissions
            .map((item) => item.teacherScore ?? item.aiScore)
            .filter((item) => item !== null && item !== undefined) as number[],
        ),
        joinedClasses: memberships.length,
        onTimeRate: submissions.length ? 100 : 0,
        pendingAssignments: pendingAssignmentsList.length,
        submissionStatusStats: ['draft', 'submitted', 'ai_reviewed', 'teacher_reviewed'].map((status) => ({
          status,
          count: submissions.filter((item) => item.status === status).length,
          percentage: submissions.length
            ? Math.round((submissions.filter((item) => item.status === status).length / submissions.length) * 100)
            : 0,
        })),
        performanceAnalysis: {
          excellentCount: submissions.filter((item) => (item.teacherScore ?? item.aiScore ?? 0) >= 90).length,
          goodCount: submissions.filter((item) => {
            const score = item.teacherScore ?? item.aiScore ?? 0;
            return score >= 80 && score < 90;
          }).length,
          passCount: submissions.filter((item) => {
            const score = item.teacherScore ?? item.aiScore ?? 0;
            return score >= 60 && score < 80;
          }).length,
          classRanking: memberships.length ? `1/${memberships.length}` : '1/1',
          perfectScoreCount: submissions.filter((item) => (item.teacherScore ?? item.aiScore ?? 0) === 100).length,
        },
        pendingAssignmentsList: pendingAssignmentsList.map((item) => ({
          assignmentId: item.assignmentId,
          title: item.title,
          classId: item.classId,
          className: item.className,
          endDate: item.endDate,
          status: item.status,
        })),
        recentSubmissions: submissions
          .slice()
          .sort(
            (a, b) =>
              new Date(b.submittedAt || b.createdAt || 0).getTime() -
              new Date(a.submittedAt || a.createdAt || 0).getTime(),
          )
          .slice(0, 10)
          .map((item) => ({
            id: item._id.toString(),
            assignmentTitle:
              assignments.find((assignment) => assignment._id.toString() === item.assignmentId)?.title || '',
            aiScore: item.aiScore,
            teacherScore: item.teacherScore,
            submittedAt: item.submittedAt || item.createdAt,
            status: item.status,
          })),
      },
      '获取成功',
    );
  }

  async getStudentLearningProgress(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException('登录失效');
    const memberships = await this.membershipModel.find({ studentId: user.id, status: 'active' }).lean();
    const classIds = memberships.map((item) => item.classId);
    const assignments = await this.assignmentModel.find({ 'classes.id': { $in: classIds } }).lean();
    const submissions = await this.submissionModel.find({ studentId: user.id, isDraft: false }).lean();

    return this.appService.envelope(
      {
        totalAssignments: assignments.length,
        completedAssignments: submissions.length,
        completionRate: assignments.length ? Math.round((submissions.length / assignments.length) * 100) : 0,
      },
      '获取成功',
    );
  }

  async getStudentAchievements(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException('登录失效');
    const submissions = await this.submissionModel.find({ studentId: user.id, isDraft: false }).lean();

    return this.appService.envelope(
      {
        excellentCount: submissions.filter((item) => (item.teacherScore ?? item.aiScore ?? 0) >= 90).length,
        reviewedCount: submissions.filter((item) => ['ai_reviewed', 'teacher_reviewed'].includes(item.status)).length,
        streakDays: submissions.length ? 1 : 0,
      },
      '获取成功',
    );
  }

  async getStudentStudyRecommendations(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException('登录失效');
    const memberships = await this.membershipModel.find({ studentId: user.id, status: 'active' }).lean();
    const classIds = memberships.map((item) => item.classId);
    const assignments = await this.assignmentModel.find({ 'classes.id': { $in: classIds } }).lean();
    const submissions = await this.submissionModel.find({ studentId: user.id, isDraft: false }).lean();

    const pendingAssignments = assignments.filter(
      (assignment) =>
        !submissions.some((submission) => submission.assignmentId === assignment._id.toString()),
    );

    return this.appService.envelope(
      pendingAssignments.slice(0, 3).map((item) => ({
        assignmentId: item._id.toString(),
        title: item.title,
        recommendation: '建议优先完成这份作业，并根据标准答案检查易错点。',
      })),
      '获取成功',
    );
  }

  private average(values: number[]) {
    if (!values.length) {
      return 0;
    }
    return Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 10) / 10;
  }
}
