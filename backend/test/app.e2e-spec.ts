import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpEnvelopeExceptionFilter } from './../src/common/filters/http-exception.filter';

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
delete process.env.DOUBAO_API_KEY;

jest.setTimeout(60000);

describe('Backend e2e', () => {
  let app: INestApplication<App>;

  type ApiEnvelope<T> = {
    code: number;
    message: string;
    data: T;
  };
  type Paginated<T> = {
    items: T[];
    total: number;
    page?: number;
    limit?: number;
    pageSize?: number;
    totalPages?: number;
  };
  type AuthUserPayload = {
    _id?: string;
    id?: string;
    username: string;
    email?: string;
    classId?: string;
    role?: string;
    name?: string;
  };
  type LoginPayload = {
    success?: boolean;
    token: string;
    refreshToken: string;
    user: AuthUserPayload;
  };
  type ClassPayload = {
    _id: string;
    name: string;
    status: string;
    code?: string;
    teacherId?: string;
    studentCount?: number;
    classId?: string;
  };
  type AssignmentPayload = {
    id: string;
    status: string;
  };
  type StudentAssignmentPayload = {
    id: string;
  };
  type SubmissionPayload = {
    id: string;
    status: string;
    submissionCount: number;
    isDraft: boolean;
  };
  type SubmissionDetailPayload = {
    submission: {
      isDraft: boolean;
      status: string;
    };
    aiReview?: {
      aiReviewMetadata: {
        queueStatus?: string;
        skippedReason?: string;
      };
    } | null;
    teacherReview?: {
      score: number;
    } | null;
  };
  type AiRulePayload = {
    id: string;
    name?: string;
    success?: boolean;
  };
  type UserPayload = {
    _id: string;
    username: string;
    status?: string;
    name?: string;
    phone?: string;
    classId?: string;
  };
  type RolePayload = {
    _id: string;
    code: string;
    description?: string;
  };
  type MenuPayload = {
    _id: string;
    code?: string;
    path?: string;
  };
  type ResourcePayload = {
    roles: RolePayload[];
    permissions: string[];
    menus: MenuPayload[];
  };
  type AiModelPayload = {
    code: string;
    apiKey?: string;
    accessKey?: string;
    secretKey?: string;
  };
  type AiModelsPayload = {
    summary: {
      totalModels: number;
    };
    models: AiModelPayload[];
  };
  type DashboardAiModelPayload = {
    isOnline: boolean;
    totalUsage: number;
    totalTokens: number;
    todayUsage: number;
    lastBalanceCheck: string;
  };
  type LogPayload = {
    _id?: string;
    endpoint: string;
    method?: string;
    username?: string;
    requestParams?: {
      body?: Record<string, string>;
    };
    responseData?: {
      data?: Record<string, string>;
    };
  };

  const unwrap = <T>(response: Response): T => {
    expect([200, 201]).toContain(response.status);
    const body = response.body as ApiEnvelope<T>;
    expect(body.code).toBe(200);
    return body.data;
  };

  const responseMessage = (response: Response): string => {
    const body = response.body as { message: string };
    return body.message;
  };

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const login = async (
    usernameOrEmailOrStudentId: string,
    password = '123456',
  ): Promise<LoginPayload> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrEmailOrStudentId, password });

    return unwrap<LoginPayload>(response);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidUnknownValues: false,
      }),
    );
    app.useGlobalFilters(new HttpEnvelopeExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns the backend readiness envelope', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);
    const body = response.body as ApiEnvelope<{ name: string; ok: boolean }>;

    expect(body).toEqual({
      code: 200,
      message: 'backend ready',
      data: {
        name: 'nengdou-backend',
        ok: true,
      },
    });
  });

  it('exposes public active classes for registration without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/classes/list')
      .query({
        page: 1,
        limit: 20,
        status: 'active',
        sort: 'name',
        order: 'asc',
      });

    const publicClasses = unwrap<Paginated<ClassPayload>>(response);
    expect(publicClasses.items.length).toBeGreaterThan(0);
    expect(publicClasses.items.every((item) => item.status === 'active')).toBe(
      true,
    );
    expect(publicClasses.items.every((item) => item.code === undefined)).toBe(
      true,
    );
    expect(
      publicClasses.items.every((item) => item.teacherId === undefined),
    ).toBe(true);

    const names = publicClasses.items.map((item) => item.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('registers students with normalized credentials and updates class membership stats', async () => {
    const publicClassesResponse = await request(app.getHttpServer())
      .get('/api/public/classes/list')
      .query({ page: 1, limit: 20, status: 'active' });
    const publicClasses = unwrap<Paginated<ClassPayload>>(
      publicClassesResponse,
    );
    const targetClass = publicClasses.items[0];
    expect(targetClass._id).toBeTruthy();

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: '  LaunchStudent  ',
        email: ' LaunchStudent@Example.com ',
        password: '123456',
        confirmPassword: '123456',
        classId: targetClass._id,
      });
    const registered = unwrap<LoginPayload & { success: boolean }>(
      registerResponse,
    );
    expect(registered.success).toBe(true);
    expect(registered.token).toBeTruthy();

    const emailLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        usernameOrEmailOrStudentId: 'LAUNCHSTUDENT@EXAMPLE.COM',
        password: '123456',
      });
    const emailLogin = unwrap<LoginPayload>(emailLoginResponse);
    expect(emailLogin.user.email).toBe('launchstudent@example.com');
    expect(emailLogin.user.username).toBe('LaunchStudent');
    expect(emailLogin.user.classId).toBe(targetClass._id);

    const classDetailResponse = await request(app.getHttpServer())
      .get(`/api/classes/${targetClass._id}`)
      .set(authHeader(emailLogin.token));
    const classDetail = unwrap<ClassPayload>(classDetailResponse);
    expect(classDetail.studentCount).toBeGreaterThanOrEqual(
      (targetClass.studentCount || 0) + 1,
    );

    const myClassesResponse = await request(app.getHttpServer())
      .get('/api/classes/list')
      .set(authHeader(emailLogin.token));
    const myClasses = unwrap<Paginated<ClassPayload>>(myClassesResponse);
    expect(myClasses.items.some((item) => item._id === targetClass._id)).toBe(
      true,
    );
  });

  it('revokes sessions on logout and blocks old tokens', async () => {
    const adminLogin = await login('admin');

    const compatLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@nengdou.local', password: '123456' });
    const compatLogin = unwrap<LoginPayload>(compatLoginResponse);
    expect(compatLogin.token).toBeTruthy();

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: adminLogin.refreshToken });
    const refreshed =
      unwrap<Pick<LoginPayload, 'token' | 'refreshToken'>>(refreshResponse);
    expect(refreshed.token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(authHeader(adminLogin.token))
      .expect(201);

    const profileAfterLogout = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set(authHeader(adminLogin.token))
      .expect(401);
    expect(responseMessage(profileAfterLogout)).toMatch(
      /Login expired|Unauthorized/,
    );

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: adminLogin.refreshToken })
      .expect(401);
    expect(responseMessage(refreshAfterLogout)).toBeTruthy();
  });

  it('runs the teacher-student assignment flow with real persistence services', async () => {
    const teacherLogin = await login('teacher1');
    const studentLogin = await login('student1');

    const createClassResponse = await request(app.getHttpServer())
      .post('/api/classes/create')
      .set(authHeader(teacherLogin.token))
      .send({
        name: 'E2E Class',
        description: 'End-to-end classroom',
        maxStudents: 40,
      });
    const createdClass = unwrap<{ classId: string }>(createClassResponse);
    expect(createdClass.classId).toBeTruthy();

    const classDetailResponse = await request(app.getHttpServer())
      .get(`/api/classes/${createdClass.classId}`)
      .set(authHeader(teacherLogin.token));
    const classDetail = unwrap<ClassPayload>(classDetailResponse);
    expect(classDetail.code).toBeTruthy();

    const joinClassResponse = await request(app.getHttpServer())
      .post('/api/classes/join')
      .set(authHeader(studentLogin.token))
      .send({ code: classDetail.code });
    const joinResult = unwrap<{ success: boolean }>(joinClassResponse);
    expect(joinResult.success).toBe(true);

    const teacherClassesResponse = await request(app.getHttpServer())
      .get('/api/classes/list')
      .set(authHeader(teacherLogin.token));
    const teacherClasses = unwrap<Paginated<ClassPayload>>(
      teacherClassesResponse,
    );
    expect(
      teacherClasses.items.some((item) => item._id === createdClass.classId),
    ).toBe(true);

    const studentClassesResponse = await request(app.getHttpServer())
      .get('/api/classes/list')
      .set(authHeader(studentLogin.token));
    const studentClasses = unwrap<Paginated<ClassPayload>>(
      studentClassesResponse,
    );
    expect(
      studentClasses.items.some((item) => item._id === createdClass.classId),
    ).toBe(true);

    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const createAssignmentResponse = await request(app.getHttpServer())
      .post('/api/teacher/assignments')
      .set(authHeader(teacherLogin.token))
      .send({
        title: 'E2E Assignment',
        description: '<p>Submit an end-to-end answer.</p>',
        classes: [createdClass.classId],
        aiRule: {
          id: 'rule-e2e',
          name: 'E2E AI Rule',
          modelType: 'doubao',
          prompt: 'Provide a score and suggestions.',
        },
        questionMaterial: { content: 'Question content' },
        referenceAnswer: { content: 'Reference answer' },
        gradingNotes: 'Grade step by step.',
        submissionFormat: 'answers_only',
        startDate,
        endDate,
        allowAttachments: true,
      });
    const createdAssignment = unwrap<AssignmentPayload>(
      createAssignmentResponse,
    );
    expect(createdAssignment.status).toBe('draft');

    const publishAssignmentResponse = await request(app.getHttpServer())
      .post(`/api/teacher/assignments/${createdAssignment.id}/status`)
      .set(authHeader(teacherLogin.token))
      .send({ status: 'published' });
    const publishedAssignment = unwrap<AssignmentPayload>(
      publishAssignmentResponse,
    );
    expect(publishedAssignment.status).toBe('published');

    const studentAssignmentsResponse = await request(app.getHttpServer())
      .get('/api/student/assignments')
      .set(authHeader(studentLogin.token))
      .query({
        classId: createdClass.classId,
        businessStatus: 'todo',
        page: 1,
        pageSize: 20,
      });
    const studentAssignments = unwrap<Paginated<StudentAssignmentPayload>>(
      studentAssignmentsResponse,
    );
    expect(
      studentAssignments.items.some((item) => item.id === createdAssignment.id),
    ).toBe(true);

    const saveDraftResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'Draft answer',
        isDraft: true,
      });
    const draftSubmission = unwrap<SubmissionPayload>(saveDraftResponse);
    expect(draftSubmission.isDraft).toBe(true);

    const getDraftResponse = await request(app.getHttpServer())
      .get(`/api/students/submissions/my/${createdAssignment.id}`)
      .set(authHeader(studentLogin.token));
    const draftDetail = unwrap<SubmissionDetailPayload>(getDraftResponse);
    expect(draftDetail.submission.isDraft).toBe(true);

    const firstSubmitResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'First final submission',
        isDraft: false,
      });
    const firstSubmission = unwrap<SubmissionPayload>(firstSubmitResponse);
    expect(firstSubmission.status).toBe('submitted');
    expect(firstSubmission.submissionCount).toBe(1);

    const afterFirstSubmitResponse = await request(app.getHttpServer())
      .get(`/api/students/submissions/my/${createdAssignment.id}`)
      .set(authHeader(studentLogin.token));
    const firstSubmitDetail = unwrap<SubmissionDetailPayload>(
      afterFirstSubmitResponse,
    );
    expect(firstSubmitDetail.aiReview).toBeTruthy();
    expect(firstSubmitDetail.aiReview?.aiReviewMetadata.queueStatus).toBe(
      'skipped',
    );
    expect(firstSubmitDetail.aiReview?.aiReviewMetadata.skippedReason).toBe(
      'queue_disabled',
    );

    const secondSubmitResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'Second final submission',
        isDraft: false,
      });
    const secondSubmission = unwrap<SubmissionPayload>(secondSubmitResponse);
    expect(secondSubmission.submissionCount).toBe(2);

    const thirdSubmitResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'Third final submission',
        isDraft: false,
      })
      .expect(400);
    expect(responseMessage(thirdSubmitResponse)).toMatch(
      /Submission limit reached/,
    );

    const submissionListResponse = await request(app.getHttpServer())
      .get('/api/teachers/submissions/list')
      .set(authHeader(teacherLogin.token))
      .query({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        status: 'submitted',
        page: 1,
        limit: 20,
      });
    const submissionList = unwrap<Paginated<SubmissionPayload>>(
      submissionListResponse,
    );
    expect(submissionList.items).toHaveLength(1);
    const submissionId = submissionList.items[0].id;

    const teacherReviewResponse = await request(app.getHttpServer())
      .post('/api/teachers/submissions/review')
      .set(authHeader(teacherLogin.token))
      .send({
        submissionId,
        teacherReviewContent: 'Teacher review complete',
        teacherScore: 92,
      });
    const teacherReview = unwrap<{ success: boolean }>(teacherReviewResponse);
    expect(teacherReview.success).toBe(true);

    const afterReviewResponse = await request(app.getHttpServer())
      .get(`/api/students/submissions/my/${createdAssignment.id}`)
      .set(authHeader(studentLogin.token));
    const reviewedDetail = unwrap<SubmissionDetailPayload>(afterReviewResponse);
    expect(reviewedDetail.submission.status).toBe('teacher_reviewed');
    expect(reviewedDetail.teacherReview?.score).toBe(92);

    const resubmitAfterReviewResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'Retry after teacher review',
        isDraft: false,
      })
      .expect(400);
    expect(responseMessage(resubmitAfterReviewResponse)).toMatch(
      /Reviewed submissions cannot be submitted again|Submission limit reached/,
    );

    const aiRuleListResponse = await request(app.getHttpServer())
      .get('/api/v1/ai-rules')
      .set(authHeader(teacherLogin.token))
      .query({ page: 1, pageSize: 20 });
    const aiRuleList = unwrap<Paginated<AiRulePayload>>(aiRuleListResponse);
    expect(aiRuleList.total).toBeGreaterThanOrEqual(1);

    const createAiRuleResponse = await request(app.getHttpServer())
      .post('/api/v1/ai-rules')
      .set(authHeader(teacherLogin.token))
      .send({
        name: 'Teacher Custom Rule',
        description: 'Teacher-owned AI rule',
        modelType: 'doubao',
        prompt: 'Give short advice.',
        visibility: 'private',
        tags: ['custom', 'teacher'],
      });
    const createdAiRule = unwrap<AiRulePayload>(createAiRuleResponse);
    expect(createdAiRule.success).toBe(true);

    const aiRuleDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai-rules/${createdAiRule.id}`)
      .set(authHeader(teacherLogin.token));
    const aiRuleDetail = unwrap<AiRulePayload>(aiRuleDetailResponse);
    expect(aiRuleDetail.name).toBe('Teacher Custom Rule');

    const updateAiRuleResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai-rules/${createdAiRule.id}/update`)
      .set(authHeader(teacherLogin.token))
      .send({ name: 'Teacher Custom Rule Updated', status: 'active' });
    const updatedAiRule = unwrap<AiRulePayload>(updateAiRuleResponse);
    expect(updatedAiRule.success).toBe(true);

    const availableAiRulesResponse = await request(app.getHttpServer())
      .get('/api/v1/ai-rules/available/list')
      .set(authHeader(teacherLogin.token))
      .query({ status: 'active' });
    const availableAiRules = unwrap<AiRulePayload[]>(availableAiRulesResponse);
    expect(availableAiRules.some((item) => item.id === createdAiRule.id)).toBe(
      true,
    );

    const activeAiModelsResponse = await request(app.getHttpServer())
      .get('/api/v1/ai-models/active')
      .set(authHeader(teacherLogin.token));
    const activeAiModels = unwrap<AiModelPayload[]>(activeAiModelsResponse);
    expect(activeAiModels.length).toBeGreaterThanOrEqual(1);
    expect(activeAiModels[0].apiKey).toBeUndefined();
    expect(activeAiModels[0].accessKey).toBeUndefined();
    expect(activeAiModels[0].secretKey).toBeUndefined();

    const copyAiRuleResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai-rules/${createdAiRule.id}/copy`)
      .set(authHeader(teacherLogin.token))
      .send({ name: 'Teacher Custom Rule Copy' });
    const copiedAiRule = unwrap<AiRulePayload>(copyAiRuleResponse);
    expect(copiedAiRule.success).toBe(true);

    const deleteCopiedAiRuleResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai-rules/${copiedAiRule.id}/delete`)
      .set(authHeader(teacherLogin.token))
      .send({});
    const deletedCopiedAiRule = unwrap<{ success: boolean }>(
      deleteCopiedAiRuleResponse,
    );
    expect(deletedCopiedAiRule.success).toBe(true);

    const teacherDashboardResponse = await request(app.getHttpServer())
      .get('/api/teacher/dashboard/stats')
      .set(authHeader(teacherLogin.token));
    const teacherDashboard = unwrap<{
      myClasses: number;
      myAssignments: number;
    }>(teacherDashboardResponse);
    expect(teacherDashboard.myClasses).toBeGreaterThanOrEqual(2);
    expect(teacherDashboard.myAssignments).toBeGreaterThanOrEqual(1);

    const studentDashboardResponse = await request(app.getHttpServer())
      .get('/api/student/dashboard/stats')
      .set(authHeader(studentLogin.token));
    const studentDashboard = unwrap<{
      completedSubmissions: number;
      joinedClasses: number;
    }>(studentDashboardResponse);
    expect(studentDashboard.completedSubmissions).toBeGreaterThanOrEqual(1);
    expect(studentDashboard.joinedClasses).toBeGreaterThanOrEqual(1);
  });

  it('supports admin user management and real admin dashboard stats', async () => {
    const adminLogin = await login('admin');

    const listBeforeResponse = await request(app.getHttpServer())
      .get('/api/users')
      .set(authHeader(adminLogin.token))
      .query({ page: 1, limit: 20 });
    const listBefore = unwrap<Paginated<UserPayload>>(listBeforeResponse);
    const totalBefore = listBefore.total;

    const aliasUserSearchResponse = await request(app.getHttpServer())
      .get('/api/users')
      .set(authHeader(adminLogin.token))
      .query({
        page: 1,
        limit: 20,
        search: 'admin',
        sort: 'username',
        order: 'asc',
      });
    const aliasUserSearch = unwrap<Paginated<UserPayload>>(
      aliasUserSearchResponse,
    );
    expect(
      aliasUserSearch.items.some((item) => item.username === 'admin'),
    ).toBe(true);

    const createdUserResponse = await request(app.getHttpServer())
      .post('/api/users')
      .set(authHeader(adminLogin.token))
      .send({
        username: 'managed_teacher',
        email: 'managed_teacher@nengdou.local',
        password: '123456',
        name: 'Managed Teacher',
        role: 'teacher',
        status: 'active',
      });
    const createdUser = unwrap<UserPayload>(createdUserResponse);
    expect(createdUser.username).toBe('managed_teacher');

    const profileResponse = await request(app.getHttpServer())
      .get('/api/users/profile')
      .set(authHeader(adminLogin.token));
    const profile = unwrap<UserPayload>(profileResponse);
    expect(profile.username).toBe('admin');

    const updateProfileResponse = await request(app.getHttpServer())
      .put('/api/users/profile')
      .set(authHeader(adminLogin.token))
      .send({ name: 'Super Admin', phone: '13800138000' });
    const updatedProfile = unwrap<UserPayload>(updateProfileResponse);
    expect(updatedProfile.name).toBe('Super Admin');
    expect(updatedProfile.phone).toBe('13800138000');

    const updatePasswordResponse = await request(app.getHttpServer())
      .put('/api/users/password')
      .set(authHeader(adminLogin.token))
      .send({
        currentPassword: '123456',
        newPassword: '654321',
      });
    const updatedPassword = unwrap<{ success: boolean }>(
      updatePasswordResponse,
    );
    expect(updatedPassword.success).toBe(true);

    const reloginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrEmailOrStudentId: 'admin', password: '654321' });
    const relogin = unwrap<LoginPayload>(reloginResponse);
    expect(relogin.token).toBeTruthy();

    const updatedUserResponse = await request(app.getHttpServer())
      .patch(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token))
      .send({ status: 'inactive', name: 'Managed Teacher 2' });
    const updatedUser = unwrap<UserPayload>(updatedUserResponse);
    expect(updatedUser.status).toBe('inactive');
    expect(updatedUser.name).toBe('Managed Teacher 2');

    const inactiveLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        usernameOrEmailOrStudentId: 'managed_teacher',
        password: '123456',
      })
      .expect(401);
    expect(responseMessage(inactiveLoginResponse)).toMatch(/inactive|locked/i);

    const resetPasswordResponse = await request(app.getHttpServer())
      .post(`/api/users/${createdUser._id}/reset-password`)
      .set(authHeader(relogin.token))
      .send({});
    const resetPasswordResult = unwrap<{
      success: boolean;
      newPassword: string;
    }>(resetPasswordResponse);
    expect(resetPasswordResult.success).toBe(true);
    expect(resetPasswordResult.newPassword).toBe('123456');

    const adminOverviewResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/overview')
      .set(authHeader(relogin.token));
    const adminOverview = unwrap<{
      totalUsers: number;
      totalClasses: number;
      totalAssignments: number;
    }>(adminOverviewResponse);
    expect(adminOverview.totalUsers).toBeGreaterThanOrEqual(totalBefore + 1);
    expect(adminOverview.totalClasses).toBeGreaterThanOrEqual(1);
    expect(adminOverview.totalAssignments).toBeGreaterThanOrEqual(1);

    const recentUsersResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/recent-users')
      .set(authHeader(relogin.token))
      .query({ limit: 5 });
    const recentUsers = unwrap<{ users: Array<{ role: string }> }>(
      recentUsersResponse,
    );
    expect(recentUsers.users.length).toBeGreaterThan(0);
    expect(recentUsers.users[0].role).toMatch(/SUPER_ADMIN|TEACHER|STUDENT/);

    const healthResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/health')
      .set(authHeader(relogin.token));
    const health = unwrap<{
      db: string;
      redis: string;
      ai: string;
      details: { db: { databaseName: string } };
    }>(healthResponse);
    expect(health.db).toBe('ok');
    expect(health.redis).toBe('disabled');
    expect(health.ai).toBe('not_configured');
    expect(health.details.db.databaseName).toBeTruthy();

    const dashboardAiModelsResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/ai-models')
      .set(authHeader(relogin.token));
    const dashboardAiModels = unwrap<Record<string, DashboardAiModelPayload>>(
      dashboardAiModelsResponse,
    );
    expect(dashboardAiModels.doubao).toBeTruthy();
    expect(typeof dashboardAiModels.doubao.isOnline).toBe('boolean');
    expect(typeof dashboardAiModels.doubao.totalUsage).toBe('number');
    expect(typeof dashboardAiModels.doubao.totalTokens).toBe('number');
    expect(typeof dashboardAiModels.doubao.todayUsage).toBe('number');
    expect(dashboardAiModels.doubao.lastBalanceCheck).toBeTruthy();

    const resourcesResponse = await request(app.getHttpServer())
      .get('/api/permissions/user-roles/users/current/resources')
      .set(authHeader(relogin.token));
    const resources = unwrap<ResourcePayload>(resourcesResponse);
    expect(resources.roles.length).toBeGreaterThan(0);
    expect(resources.permissions).toContain('system:manage');
    expect(resources.menus.length).toBeGreaterThan(0);

    const rolesResponse = await request(app.getHttpServer())
      .get('/api/permissions/roles')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20 });
    const roles = unwrap<Paginated<RolePayload>>(rolesResponse);
    expect(roles.items.length).toBeGreaterThanOrEqual(3);

    const filteredRolesResponse = await request(app.getHttpServer())
      .get('/api/permissions/roles')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, code: 'teacher' });
    const filteredRoles = unwrap<Paginated<RolePayload>>(filteredRolesResponse);
    expect(filteredRoles.items.some((item) => item.code === 'teacher')).toBe(
      true,
    );

    const invalidRoleQueryResponse = await request(app.getHttpServer())
      .get('/api/permissions/roles')
      .set(authHeader(relogin.token))
      .query({ sort: 'dropDatabase' })
      .expect(400);
    expect(responseMessage(invalidRoleQueryResponse)).toBeTruthy();

    const menusResponse = await request(app.getHttpServer())
      .get('/api/permissions/menus')
      .set(authHeader(relogin.token));
    const menus = unwrap<MenuPayload[]>(menusResponse);
    expect(menus.length).toBeGreaterThan(0);

    const createMenuResponse = await request(app.getHttpServer())
      .post('/api/permissions/menus')
      .set(authHeader(relogin.token))
      .send({
        name: 'E2E Custom Menu',
        code: 'e2e:custom-menu',
        path: '/system/e2e-menu',
        component: 'system/e2e/menu',
        type: 'menu',
        sort: 999,
        status: 'active',
        meta: { title: 'E2E Menu' },
      });
    const createdMenu = unwrap<MenuPayload>(createMenuResponse);
    expect(createdMenu.code).toBe('e2e:custom-menu');

    const updateMenuResponse = await request(app.getHttpServer())
      .put(`/api/permissions/menus/${createdMenu._id}`)
      .set(authHeader(relogin.token))
      .send({
        path: '/system/e2e-menu-updated',
        meta: { title: 'E2E Menu Updated' },
      });
    const updatedMenu = unwrap<MenuPayload>(updateMenuResponse);
    expect(updatedMenu.path).toBe('/system/e2e-menu-updated');

    const createRoleResponse = await request(app.getHttpServer())
      .post('/api/permissions/roles')
      .set(authHeader(relogin.token))
      .send({
        name: 'E2E Custom Role',
        code: 'e2e_custom_role',
        description: 'Role created in e2e',
        menuIds: [createdMenu._id],
        permissions: ['e2e:access'],
      });
    const createdRole = unwrap<RolePayload>(createRoleResponse);
    expect(createdRole.code).toBe('e2e_custom_role');

    const roleWithMenusResponse = await request(app.getHttpServer())
      .get(`/api/permissions/roles/${createdRole._id}/with-menus`)
      .set(authHeader(relogin.token));
    const roleWithMenus = unwrap<{ menus: MenuPayload[] }>(
      roleWithMenusResponse,
    );
    expect(
      roleWithMenus.menus.some((item) => item._id === createdMenu._id),
    ).toBe(true);

    const updateRoleResponse = await request(app.getHttpServer())
      .put(`/api/permissions/roles/${createdRole._id}`)
      .set(authHeader(relogin.token))
      .send({ description: 'Updated role description' });
    const updatedRole = unwrap<RolePayload>(updateRoleResponse);
    expect(updatedRole.description).toBe('Updated role description');

    const assignRoleResponse = await request(app.getHttpServer())
      .put(`/api/permissions/user-roles/users/${createdUser._id}/roles`)
      .set(authHeader(relogin.token))
      .send({ roleIds: [createdRole._id] });
    const assignedRole = unwrap<boolean>(assignRoleResponse);
    expect(assignedRole).toBe(true);

    const createdUserResourcesResponse = await request(app.getHttpServer())
      .get(`/api/permissions/user-roles/users/${createdUser._id}/resources`)
      .set(authHeader(relogin.token));
    const createdUserResources = unwrap<ResourcePayload>(
      createdUserResourcesResponse,
    );
    expect(
      createdUserResources.roles.some((item) => item._id === createdRole._id),
    ).toBe(true);
    expect(createdUserResources.permissions).toContain('e2e:access');

    const forgotPasswordResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'managed_teacher@nengdou.local' });
    const forgotPasswordResult = unwrap<{
      success: boolean;
      resetToken: string;
    }>(forgotPasswordResponse);
    expect(forgotPasswordResult.success).toBe(true);
    expect(forgotPasswordResult.resetToken).toBeTruthy();

    const resetPasswordByTokenResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: forgotPasswordResult.resetToken,
        password: 'reset654',
        confirmPassword: 'reset654',
      });
    const resetPasswordByTokenResult = unwrap<{ success: boolean }>(
      resetPasswordByTokenResponse,
    );
    expect(resetPasswordByTokenResult.success).toBe(true);

    const reactivateUserResponse = await request(app.getHttpServer())
      .patch(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token))
      .send({ status: 'active' });
    const reactivatedUser = unwrap<UserPayload>(reactivateUserResponse);
    expect(reactivatedUser.status).toBe('active');

    const resetLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        usernameOrEmailOrStudentId: 'managed_teacher',
        password: 'reset654',
      });
    const resetLogin = unwrap<LoginPayload>(resetLoginResponse);
    expect(resetLogin.token).toBeTruthy();

    const disableUserAfterLoginResponse = await request(app.getHttpServer())
      .patch(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token))
      .send({ status: 'inactive' });
    const disabledUserAfterLogin = unwrap<UserPayload>(
      disableUserAfterLoginResponse,
    );
    expect(disabledUserAfterLogin.status).toBe('inactive');

    const disabledProfileResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set(authHeader(resetLogin.token))
      .expect(401);
    expect(responseMessage(disabledProfileResponse)).toMatch(
      /inactive|locked/i,
    );

    const enableUserAgainResponse = await request(app.getHttpServer())
      .patch(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token))
      .send({ status: 'active' });
    const enabledUserAgain = unwrap<UserPayload>(enableUserAgainResponse);
    expect(enabledUserAgain.status).toBe('active');

    const activeTeacherLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        usernameOrEmailOrStudentId: 'managed_teacher',
        password: 'reset654',
      });
    const activeTeacherLogin = unwrap<LoginPayload>(activeTeacherLoginResponse);
    expect(activeTeacherLogin.token).toBeTruthy();

    const invalidImportResponse = await request(app.getHttpServer())
      .post('/api/users/batch-import')
      .set(authHeader(relogin.token))
      .send({ items: [] })
      .expect(400);
    expect(responseMessage(invalidImportResponse)).toBeTruthy();

    const aiModelsResponse = await request(app.getHttpServer())
      .get('/api/admin/ai-models')
      .set(authHeader(relogin.token));
    const aiModels = unwrap<AiModelsPayload>(aiModelsResponse);
    expect(aiModels.summary.totalModels).toBeGreaterThanOrEqual(1);
    const aiModelCode = aiModels.models[0].code;

    const activeAiModelsResponse = await request(app.getHttpServer())
      .get('/api/admin/ai-models/active')
      .set(authHeader(relogin.token));
    const activeAiModels = unwrap<AiModelPayload[]>(activeAiModelsResponse);
    expect(activeAiModels.some((item) => item.code === aiModelCode)).toBe(true);

    const aiModelDetailResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-models/${aiModelCode}`)
      .set(authHeader(relogin.token));
    const aiModelDetail = unwrap<AiModelPayload>(aiModelDetailResponse);
    expect(aiModelDetail.code).toBe(aiModelCode);

    const invalidAiModelUpdateResponse = await request(app.getHttpServer())
      .put(`/api/admin/ai-models/${aiModelCode}`)
      .set(authHeader(relogin.token))
      .send({ status: 'broken-status' })
      .expect(400);
    expect(responseMessage(invalidAiModelUpdateResponse)).toBeTruthy();

    const updateAiModelResponse = await request(app.getHttpServer())
      .put(`/api/admin/ai-models/${aiModelCode}`)
      .set(authHeader(relogin.token))
      .send({ apiKey: 'e2e-api-key', status: 'active' });
    const updatedAiModel = unwrap<AiModelPayload>(updateAiModelResponse);
    expect(updatedAiModel.apiKey).toBe('e2e-api-key');

    const refreshedDashboardAiModelsResponse = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/dashboard/ai-models')
      .set(authHeader(relogin.token));
    const refreshedDashboardAiModels = unwrap<
      Record<string, DashboardAiModelPayload>
    >(refreshedDashboardAiModelsResponse);
    expect(refreshedDashboardAiModels[aiModelCode].isOnline).toBe(true);

    const balanceResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-models/${aiModelCode}/balance`)
      .set(authHeader(relogin.token));
    const balance = unwrap<{ status: string }>(balanceResponse);
    expect(balance.status).toBe('success');

    const testModelResponse = await request(app.getHttpServer())
      .post(`/api/admin/ai-models/${aiModelCode}/test`)
      .set(authHeader(relogin.token))
      .send({});
    const testModel = unwrap<{ success: boolean }>(testModelResponse);
    expect(typeof testModel.success).toBe('boolean');

    const modelStatsResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-models/${aiModelCode}/stats`)
      .set(authHeader(relogin.token));
    const modelStats = unwrap<{ dailyUsage: unknown[] }>(modelStatsResponse);
    expect(Array.isArray(modelStats.dailyUsage)).toBe(true);

    const initializeModelsResponse = await request(app.getHttpServer())
      .post('/api/admin/ai-models/initialize')
      .set(authHeader(relogin.token))
      .send({});
    const initializeModels = unwrap<{ success: boolean }>(
      initializeModelsResponse,
    );
    expect(initializeModels.success).toBe(true);

    const logsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20 });
    const logs = unwrap<Paginated<LogPayload>>(logsResponse);
    expect(logs.total).toBeGreaterThan(0);
    expect(logs.items[0].endpoint).toBeTruthy();

    const loginLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({
        page: 1,
        limit: 20,
        endpoint: '/api/v1/auth/login',
        username: 'admin',
      });
    const loginLogs = unwrap<Paginated<LogPayload>>(loginLogsResponse);
    const loginLog = loginLogs.items.find((item) =>
      item.endpoint.includes('/api/v1/auth/login'),
    );
    expect(loginLog).toBeTruthy();
    expect(loginLog?.username).toBe('admin');
    expect(loginLog?.requestParams?.body?.password).toBe('[REDACTED]');
    expect(loginLog?.responseData?.data?.token).toBe('[REDACTED]');
    expect(loginLog?.responseData?.data?.refreshToken).toBe('[REDACTED]');

    const teacherLogsForbiddenResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(activeTeacherLogin.token))
      .expect(403);
    expect(responseMessage(teacherLogsForbiddenResponse)).toBeTruthy();

    const resetPasswordLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, endpoint: '/reset-password' });
    const resetPasswordLogs = unwrap<Paginated<LogPayload>>(
      resetPasswordLogsResponse,
    );
    const resetPasswordLog = resetPasswordLogs.items.find((item) =>
      item.endpoint.includes(`/api/users/${createdUser._id}/reset-password`),
    );
    expect(resetPasswordLog).toBeTruthy();
    expect(resetPasswordLog?.responseData?.data?.newPassword).toBe(
      '[REDACTED]',
    );

    const forgotPasswordLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, endpoint: '/api/v1/auth/forgot-password' });
    const forgotPasswordLogs = unwrap<Paginated<LogPayload>>(
      forgotPasswordLogsResponse,
    );
    const forgotPasswordLog = forgotPasswordLogs.items.find((item) =>
      item.endpoint.includes('/api/v1/auth/forgot-password'),
    );
    expect(forgotPasswordLog).toBeTruthy();
    expect(forgotPasswordLog?.responseData?.data?.resetToken).toBe(
      '[REDACTED]',
    );

    const aiModelLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({
        page: 1,
        limit: 20,
        endpoint: `/api/admin/ai-models/${aiModelCode}`,
      });
    const aiModelLogs = unwrap<Paginated<LogPayload>>(aiModelLogsResponse);
    const aiModelLog = aiModelLogs.items.find(
      (item) =>
        item.method === 'PUT' &&
        item.endpoint.includes(`/api/admin/ai-models/${aiModelCode}`),
    );
    expect(aiModelLog).toBeTruthy();
    expect(aiModelLog?.requestParams?.body?.apiKey).toBe('[REDACTED]');

    const deleteUserResponse = await request(app.getHttpServer())
      .delete(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token));
    const deletedUser = unwrap<{ success: boolean }>(deleteUserResponse);
    expect(deletedUser.success).toBe(true);

    const deleteRoleResponse = await request(app.getHttpServer())
      .delete(`/api/permissions/roles/${createdRole._id}`)
      .set(authHeader(relogin.token));
    const deletedRole = unwrap<{ success: boolean }>(deleteRoleResponse);
    expect(deletedRole.success).toBe(true);

    const deleteMenuResponse = await request(app.getHttpServer())
      .delete(`/api/permissions/menus/${createdMenu._id}`)
      .set(authHeader(relogin.token));
    const deletedMenu = unwrap<{ success: boolean }>(deleteMenuResponse);
    expect(deletedMenu.success).toBe(true);

    const restorePasswordResponse = await request(app.getHttpServer())
      .put('/api/users/password')
      .set(authHeader(relogin.token))
      .send({
        currentPassword: '654321',
        newPassword: '123456',
      });
    const restorePasswordResult = unwrap<{ success: boolean }>(
      restorePasswordResponse,
    );
    expect(restorePasswordResult.success).toBe(true);
  });
});
