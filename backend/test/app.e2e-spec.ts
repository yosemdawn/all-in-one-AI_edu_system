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

    const deleteUserResponse = await request(app.getHttpServer())
      .delete(`/api/users/${createdUser._id}`)
      .set(authHeader(relogin.token));
    const deletedUser = unwrap(deleteUserResponse);
    expect(deletedUser.success).toBe(true);

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
