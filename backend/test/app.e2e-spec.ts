import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpEnvelopeExceptionFilter } from './../src/common/filters/http-exception.filter';

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
delete process.env.DOUBAO_API_KEY;

jest.setTimeout(60000);

describe('Backend e2e', () => {
  let app: INestApplication<App>;

  const unwrap = (response: any) => {
    expect([200, 201]).toContain(response.status);
    expect(response.body.code).toBe(200);
    return response.body.data;
  };

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const login = async (usernameOrEmailOrStudentId: string, password = '123456') => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrEmailOrStudentId, password });

    return unwrap(response);
  };

  beforeAll(async () => {
    const { AppModule } = require('./../src/app.module');
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

    expect(response.body).toEqual({
      code: 200,
      message: 'backend ready',
      data: {
        name: 'nengdou-backend',
        ok: true,
      },
    });
  });

  it('revokes sessions on logout and blocks old tokens', async () => {
    const adminLogin = await login('admin');

    const compatLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@nengdou.local', password: '123456' });
    const compatLogin = unwrap(compatLoginResponse);
    expect(compatLogin.token).toBeTruthy();

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: adminLogin.refreshToken });
    const refreshed = unwrap(refreshResponse);
    expect(refreshed.token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(authHeader(adminLogin.token))
      .expect(201);

    const profileAfterLogout = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set(authHeader(adminLogin.token))
      .expect(401);
    expect(profileAfterLogout.body.message).toMatch(/Login expired|Unauthorized/);

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: adminLogin.refreshToken })
      .expect(401);
    expect(refreshAfterLogout.body.message).toBeTruthy();
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
    const createdClass = unwrap(createClassResponse);
    expect(createdClass.classId).toBeTruthy();

    const classDetailResponse = await request(app.getHttpServer())
      .get(`/api/classes/${createdClass.classId}`)
      .set(authHeader(teacherLogin.token));
    const classDetail = unwrap(classDetailResponse);
    expect(classDetail.code).toBeTruthy();

    const joinClassResponse = await request(app.getHttpServer())
      .post('/api/classes/join')
      .set(authHeader(studentLogin.token))
      .send({ code: classDetail.code });
    const joinResult = unwrap(joinClassResponse);
    expect(joinResult.success).toBe(true);

    const teacherClassesResponse = await request(app.getHttpServer())
      .get('/api/classes/list')
      .set(authHeader(teacherLogin.token));
    const teacherClasses = unwrap(teacherClassesResponse);
    expect(teacherClasses.items.some((item: any) => item._id === createdClass.classId)).toBe(true);

    const studentClassesResponse = await request(app.getHttpServer())
      .get('/api/classes/list')
      .set(authHeader(studentLogin.token));
    const studentClasses = unwrap(studentClassesResponse);
    expect(studentClasses.items.some((item: any) => item._id === createdClass.classId)).toBe(true);

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
    const createdAssignment = unwrap(createAssignmentResponse);
    expect(createdAssignment.status).toBe('draft');

    const publishAssignmentResponse = await request(app.getHttpServer())
      .post(`/api/teacher/assignments/${createdAssignment.id}/status`)
      .set(authHeader(teacherLogin.token))
      .send({ status: 'published' });
    const publishedAssignment = unwrap(publishAssignmentResponse);
    expect(publishedAssignment.status).toBe('published');

    const studentAssignmentsResponse = await request(app.getHttpServer())
      .get('/api/student/assignments')
      .set(authHeader(studentLogin.token))
      .query({ classId: createdClass.classId, businessStatus: 'todo', page: 1, pageSize: 20 });
    const studentAssignments = unwrap(studentAssignmentsResponse);
    expect(studentAssignments.items.some((item: any) => item.id === createdAssignment.id)).toBe(true);

    const saveDraftResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'Draft answer',
        isDraft: true,
      });
    const draftSubmission = unwrap(saveDraftResponse);
    expect(draftSubmission.isDraft).toBe(true);

    const getDraftResponse = await request(app.getHttpServer())
      .get(`/api/students/submissions/my/${createdAssignment.id}`)
      .set(authHeader(studentLogin.token));
    const draftDetail = unwrap(getDraftResponse);
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
    const firstSubmission = unwrap(firstSubmitResponse);
    expect(firstSubmission.status).toBe('submitted');
    expect(firstSubmission.submissionCount).toBe(1);

    const afterFirstSubmitResponse = await request(app.getHttpServer())
      .get(`/api/students/submissions/my/${createdAssignment.id}`)
      .set(authHeader(studentLogin.token));
    const firstSubmitDetail = unwrap(afterFirstSubmitResponse);
    expect(firstSubmitDetail.aiReview).toBeTruthy();
    expect(firstSubmitDetail.aiReview.aiReviewMetadata.queueStatus).toBe('skipped');
    expect(firstSubmitDetail.aiReview.aiReviewMetadata.skippedReason).toBe('queue_disabled');

    const secondSubmitResponse = await request(app.getHttpServer())
      .post('/api/students/submissions/submit')
      .set(authHeader(studentLogin.token))
      .send({
        assignmentId: createdAssignment.id,
        classId: createdClass.classId,
        content: 'Second final submission',
        isDraft: false,
      });
    const secondSubmission = unwrap(secondSubmitResponse);
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
    expect(thirdSubmitResponse.body.message).toMatch(/Submission limit reached/);

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
    const submissionList = unwrap(submissionListResponse);
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
    const teacherReview = unwrap(teacherReviewResponse);
    expect(teacherReview.success).toBe(true);

    const afterReviewResponse = await request(app.getHttpServer())
      .get(`/api/students/submissions/my/${createdAssignment.id}`)
      .set(authHeader(studentLogin.token));
    const reviewedDetail = unwrap(afterReviewResponse);
    expect(reviewedDetail.submission.status).toBe('teacher_reviewed');
    expect(reviewedDetail.teacherReview.score).toBe(92);

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
    expect(resubmitAfterReviewResponse.body.message).toMatch(
      /Reviewed submissions cannot be submitted again|Submission limit reached/,
    );

    const aiRuleListResponse = await request(app.getHttpServer())
      .get('/api/v1/ai-rules')
      .set(authHeader(teacherLogin.token))
      .query({ page: 1, pageSize: 20 });
    const aiRuleList = unwrap(aiRuleListResponse);
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
    const createdAiRule = unwrap(createAiRuleResponse);
    expect(createdAiRule.success).toBe(true);

    const aiRuleDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai-rules/${createdAiRule.id}`)
      .set(authHeader(teacherLogin.token));
    const aiRuleDetail = unwrap(aiRuleDetailResponse);
    expect(aiRuleDetail.name).toBe('Teacher Custom Rule');

    const updateAiRuleResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai-rules/${createdAiRule.id}/update`)
      .set(authHeader(teacherLogin.token))
      .send({ name: 'Teacher Custom Rule Updated', status: 'active' });
    const updatedAiRule = unwrap(updateAiRuleResponse);
    expect(updatedAiRule.success).toBe(true);

    const availableAiRulesResponse = await request(app.getHttpServer())
      .get('/api/v1/ai-rules/available/list')
      .set(authHeader(teacherLogin.token))
      .query({ status: 'active' });
    const availableAiRules = unwrap(availableAiRulesResponse);
    expect(availableAiRules.some((item: any) => item.id === createdAiRule.id)).toBe(true);

    const activeAiModelsResponse = await request(app.getHttpServer())
      .get('/api/v1/ai-models/active')
      .set(authHeader(teacherLogin.token));
    const activeAiModels = unwrap(activeAiModelsResponse);
    expect(activeAiModels.length).toBeGreaterThanOrEqual(1);
    expect(activeAiModels[0].apiKey).toBeUndefined();
    expect(activeAiModels[0].accessKey).toBeUndefined();
    expect(activeAiModels[0].secretKey).toBeUndefined();

    const copyAiRuleResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai-rules/${createdAiRule.id}/copy`)
      .set(authHeader(teacherLogin.token))
      .send({ name: 'Teacher Custom Rule Copy' });
    const copiedAiRule = unwrap(copyAiRuleResponse);
    expect(copiedAiRule.success).toBe(true);

    const deleteCopiedAiRuleResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai-rules/${copiedAiRule.id}/delete`)
      .set(authHeader(teacherLogin.token))
      .send({});
    const deletedCopiedAiRule = unwrap(deleteCopiedAiRuleResponse);
    expect(deletedCopiedAiRule.success).toBe(true);

    const teacherDashboardResponse = await request(app.getHttpServer())
      .get('/api/teacher/dashboard/stats')
      .set(authHeader(teacherLogin.token));
    const teacherDashboard = unwrap(teacherDashboardResponse);
    expect(teacherDashboard.myClasses).toBeGreaterThanOrEqual(2);
    expect(teacherDashboard.myAssignments).toBeGreaterThanOrEqual(1);

    const studentDashboardResponse = await request(app.getHttpServer())
      .get('/api/student/dashboard/stats')
      .set(authHeader(studentLogin.token));
    const studentDashboard = unwrap(studentDashboardResponse);
    expect(studentDashboard.completedSubmissions).toBeGreaterThanOrEqual(1);
    expect(studentDashboard.joinedClasses).toBeGreaterThanOrEqual(1);
  });

  it('supports admin user management and real admin dashboard stats', async () => {
    const adminLogin = await login('admin');

    const listBeforeResponse = await request(app.getHttpServer())
      .get('/api/users')
      .set(authHeader(adminLogin.token))
      .query({ page: 1, limit: 20 });
    const listBefore = unwrap(listBeforeResponse);
    const totalBefore = listBefore.total;

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
    const createdUser = unwrap(createdUserResponse);
    expect(createdUser.username).toBe('managed_teacher');

    const profileResponse = await request(app.getHttpServer())
      .get('/api/users/profile')
      .set(authHeader(adminLogin.token));
    const profile = unwrap(profileResponse);
    expect(profile.username).toBe('admin');

    const updateProfileResponse = await request(app.getHttpServer())
      .put('/api/users/profile')
      .set(authHeader(adminLogin.token))
      .send({ name: 'Super Admin', phone: '13800138000' });
    const updatedProfile = unwrap(updateProfileResponse);
    expect(updatedProfile.name).toBe('Super Admin');
    expect(updatedProfile.phone).toBe('13800138000');

    const updatePasswordResponse = await request(app.getHttpServer())
      .put('/api/users/password')
      .set(authHeader(adminLogin.token))
      .send({
        currentPassword: '123456',
        newPassword: '654321',
      });
    const updatedPassword = unwrap(updatePasswordResponse);
    expect(updatedPassword.success).toBe(true);

    const reloginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrEmailOrStudentId: 'admin', password: '654321' });
    const relogin = unwrap(reloginResponse);
    expect(relogin.token).toBeTruthy();

    const updatedUserResponse = await request(app.getHttpServer())
      .patch(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token))
      .send({ status: 'inactive', name: 'Managed Teacher 2' });
    const updatedUser = unwrap(updatedUserResponse);
    expect(updatedUser.status).toBe('inactive');
    expect(updatedUser.name).toBe('Managed Teacher 2');

    const resetPasswordResponse = await request(app.getHttpServer())
      .post(`/api/users/${createdUser._id}/reset-password`)
      .set(authHeader(relogin.token))
      .send({});
    const resetPasswordResult = unwrap(resetPasswordResponse);
    expect(resetPasswordResult.success).toBe(true);
    expect(resetPasswordResult.newPassword).toBe('123456');

    const adminOverviewResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/overview')
      .set(authHeader(relogin.token));
    const adminOverview = unwrap(adminOverviewResponse);
    expect(adminOverview.totalUsers).toBeGreaterThanOrEqual(totalBefore + 1);
    expect(adminOverview.totalClasses).toBeGreaterThanOrEqual(1);
    expect(adminOverview.totalAssignments).toBeGreaterThanOrEqual(1);

    const recentUsersResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/recent-users')
      .set(authHeader(relogin.token))
      .query({ limit: 5 });
    const recentUsers = unwrap(recentUsersResponse);
    expect(recentUsers.users.length).toBeGreaterThan(0);
    expect(recentUsers.users[0].role).toMatch(/SUPER_ADMIN|TEACHER|STUDENT/);

    const healthResponse = await request(app.getHttpServer())
      .get('/api/admin/dashboard/health')
      .set(authHeader(relogin.token));
    const health = unwrap(healthResponse);
    expect(health.db).toBe('ok');

    const resourcesResponse = await request(app.getHttpServer())
      .get('/api/permissions/user-roles/users/current/resources')
      .set(authHeader(relogin.token));
    const resources = unwrap(resourcesResponse);
    expect(resources.roles.length).toBeGreaterThan(0);
    expect(resources.permissions).toContain('system:manage');
    expect(resources.menus.length).toBeGreaterThan(0);

    const rolesResponse = await request(app.getHttpServer())
      .get('/api/permissions/roles')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20 });
    const roles = unwrap(rolesResponse);
    expect(roles.items.length).toBeGreaterThanOrEqual(3);

    const invalidRoleQueryResponse = await request(app.getHttpServer())
      .get('/api/permissions/roles')
      .set(authHeader(relogin.token))
      .query({ sort: 'dropDatabase' })
      .expect(400);
    expect(invalidRoleQueryResponse.body.message).toBeTruthy();

    const menusResponse = await request(app.getHttpServer())
      .get('/api/permissions/menus')
      .set(authHeader(relogin.token));
    const menus = unwrap(menusResponse);
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
    const createdMenu = unwrap(createMenuResponse);
    expect(createdMenu.code).toBe('e2e:custom-menu');

    const updateMenuResponse = await request(app.getHttpServer())
      .put(`/api/permissions/menus/${createdMenu._id}`)
      .set(authHeader(relogin.token))
      .send({ path: '/system/e2e-menu-updated', meta: { title: 'E2E Menu Updated' } });
    const updatedMenu = unwrap(updateMenuResponse);
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
    const createdRole = unwrap(createRoleResponse);
    expect(createdRole.code).toBe('e2e_custom_role');

    const roleWithMenusResponse = await request(app.getHttpServer())
      .get(`/api/permissions/roles/${createdRole._id}/with-menus`)
      .set(authHeader(relogin.token));
    const roleWithMenus = unwrap(roleWithMenusResponse);
    expect(roleWithMenus.menus.some((item: any) => item._id === createdMenu._id)).toBe(true);

    const updateRoleResponse = await request(app.getHttpServer())
      .put(`/api/permissions/roles/${createdRole._id}`)
      .set(authHeader(relogin.token))
      .send({ description: 'Updated role description' });
    const updatedRole = unwrap(updateRoleResponse);
    expect(updatedRole.description).toBe('Updated role description');

    const assignRoleResponse = await request(app.getHttpServer())
      .put(`/api/permissions/user-roles/users/${createdUser._id}/roles`)
      .set(authHeader(relogin.token))
      .send({ roleIds: [createdRole._id] });
    const assignedRole = unwrap(assignRoleResponse);
    expect(assignedRole).toBe(true);

    const createdUserResourcesResponse = await request(app.getHttpServer())
      .get(`/api/permissions/user-roles/users/${createdUser._id}/resources`)
      .set(authHeader(relogin.token));
    const createdUserResources = unwrap(createdUserResourcesResponse);
    expect(createdUserResources.roles.some((item: any) => item._id === createdRole._id)).toBe(true);
    expect(createdUserResources.permissions).toContain('e2e:access');

    const forgotPasswordResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'managed_teacher@nengdou.local' });
    const forgotPasswordResult = unwrap(forgotPasswordResponse);
    expect(forgotPasswordResult.success).toBe(true);
    expect(forgotPasswordResult.resetToken).toBeTruthy();

    const resetPasswordByTokenResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: forgotPasswordResult.resetToken,
        password: 'reset654',
        confirmPassword: 'reset654',
      });
    const resetPasswordByTokenResult = unwrap(resetPasswordByTokenResponse);
    expect(resetPasswordByTokenResult.success).toBe(true);

    const resetLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrEmailOrStudentId: 'managed_teacher', password: 'reset654' });
    const resetLogin = unwrap(resetLoginResponse);
    expect(resetLogin.token).toBeTruthy();

    const invalidImportResponse = await request(app.getHttpServer())
      .post('/api/users/batch-import')
      .set(authHeader(relogin.token))
      .send({ items: [] })
      .expect(400);
    expect(invalidImportResponse.body.message).toBeTruthy();

    const aiModelsResponse = await request(app.getHttpServer())
      .get('/api/admin/ai-models')
      .set(authHeader(relogin.token));
    const aiModels = unwrap(aiModelsResponse);
    expect(aiModels.summary.totalModels).toBeGreaterThanOrEqual(1);
    const aiModelCode = aiModels.models[0].code;

    const activeAiModelsResponse = await request(app.getHttpServer())
      .get('/api/admin/ai-models/active')
      .set(authHeader(relogin.token));
    const activeAiModels = unwrap(activeAiModelsResponse);
    expect(activeAiModels.some((item: any) => item.code === aiModelCode)).toBe(true);

    const aiModelDetailResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-models/${aiModelCode}`)
      .set(authHeader(relogin.token));
    const aiModelDetail = unwrap(aiModelDetailResponse);
    expect(aiModelDetail.code).toBe(aiModelCode);

    const invalidAiModelUpdateResponse = await request(app.getHttpServer())
      .put(`/api/admin/ai-models/${aiModelCode}`)
      .set(authHeader(relogin.token))
      .send({ status: 'broken-status' })
      .expect(400);
    expect(invalidAiModelUpdateResponse.body.message).toBeTruthy();

    const updateAiModelResponse = await request(app.getHttpServer())
      .put(`/api/admin/ai-models/${aiModelCode}`)
      .set(authHeader(relogin.token))
      .send({ apiKey: 'e2e-api-key', status: 'active' });
    const updatedAiModel = unwrap(updateAiModelResponse);
    expect(updatedAiModel.apiKey).toBe('e2e-api-key');

    const balanceResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-models/${aiModelCode}/balance`)
      .set(authHeader(relogin.token));
    const balance = unwrap(balanceResponse);
    expect(balance.status).toBe('success');

    const testModelResponse = await request(app.getHttpServer())
      .post(`/api/admin/ai-models/${aiModelCode}/test`)
      .set(authHeader(relogin.token))
      .send({});
    const testModel = unwrap(testModelResponse);
    expect(typeof testModel.success).toBe('boolean');

    const modelStatsResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-models/${aiModelCode}/stats`)
      .set(authHeader(relogin.token));
    const modelStats = unwrap(modelStatsResponse);
    expect(Array.isArray(modelStats.dailyUsage)).toBe(true);

    const initializeModelsResponse = await request(app.getHttpServer())
      .post('/api/admin/ai-models/initialize')
      .set(authHeader(relogin.token))
      .send({});
    const initializeModels = unwrap(initializeModelsResponse);
    expect(initializeModels.success).toBe(true);

    const logsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20 });
    const logs = unwrap(logsResponse);
    expect(logs.total).toBeGreaterThan(0);
    expect(logs.items[0].endpoint).toBeTruthy();

    const loginLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, endpoint: '/api/v1/auth/login' });
    const loginLogs = unwrap(loginLogsResponse);
    const loginLog = loginLogs.items.find((item: any) => item.endpoint.includes('/api/v1/auth/login'));
    expect(loginLog).toBeTruthy();
    expect(loginLog.requestParams.body.password).toBe('[REDACTED]');
    expect(loginLog.responseData.data.token).toBe('[REDACTED]');
    expect(loginLog.responseData.data.refreshToken).toBe('[REDACTED]');

    const resetPasswordLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, endpoint: '/reset-password' });
    const resetPasswordLogs = unwrap(resetPasswordLogsResponse);
    const resetPasswordLog = resetPasswordLogs.items.find((item: any) =>
      item.endpoint.includes(`/api/users/${createdUser._id}/reset-password`),
    );
    expect(resetPasswordLog).toBeTruthy();
    expect(resetPasswordLog.responseData.data.newPassword).toBe('[REDACTED]');

    const forgotPasswordLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, endpoint: '/api/v1/auth/forgot-password' });
    const forgotPasswordLogs = unwrap(forgotPasswordLogsResponse);
    const forgotPasswordLog = forgotPasswordLogs.items.find((item: any) =>
      item.endpoint.includes('/api/v1/auth/forgot-password'),
    );
    expect(forgotPasswordLog).toBeTruthy();
    expect(forgotPasswordLog.responseData.data.resetToken).toBe('[REDACTED]');

    const aiModelLogsResponse = await request(app.getHttpServer())
      .get('/api/logs')
      .set(authHeader(relogin.token))
      .query({ page: 1, limit: 20, endpoint: `/api/admin/ai-models/${aiModelCode}` });
    const aiModelLogs = unwrap(aiModelLogsResponse);
    const aiModelLog = aiModelLogs.items.find(
      (item: any) =>
        item.method === 'PUT' && item.endpoint.includes(`/api/admin/ai-models/${aiModelCode}`),
    );
    expect(aiModelLog).toBeTruthy();
    expect(aiModelLog.requestParams.body.apiKey).toBe('[REDACTED]');

    const deleteUserResponse = await request(app.getHttpServer())
      .delete(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token));
    const deletedUser = unwrap(deleteUserResponse);
    expect(deletedUser.success).toBe(true);

    const deleteRoleResponse = await request(app.getHttpServer())
      .delete(`/api/permissions/roles/${createdRole._id}`)
      .set(authHeader(relogin.token));
    const deletedRole = unwrap(deleteRoleResponse);
    expect(deletedRole.success).toBe(true);

    const deleteMenuResponse = await request(app.getHttpServer())
      .delete(`/api/permissions/menus/${createdMenu._id}`)
      .set(authHeader(relogin.token));
    const deletedMenu = unwrap(deleteMenuResponse);
    expect(deletedMenu.success).toBe(true);

    const restorePasswordResponse = await request(app.getHttpServer())
      .put('/api/users/password')
      .set(authHeader(relogin.token))
      .send({
        currentPassword: '654321',
        newPassword: '123456',
      });
    const restorePasswordResult = unwrap(restorePasswordResponse);
    expect(restorePasswordResult.success).toBe(true);
  });
});
