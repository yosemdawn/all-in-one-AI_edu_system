import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { Job } from 'bullmq';
import { AppModule } from '../src/app.module';
import { HttpEnvelopeExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  Assignment,
  AssignmentDocument,
} from '../src/assignments/schemas/assignment.schema';
import {
  Submission,
  SubmissionDocument,
} from '../src/submissions/schemas/submission.schema';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import {
  ClassEntity,
  ClassDocument,
} from '../src/classes/schemas/class.schema';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../src/classes/schemas/class-membership.schema';
import { AiReviewProcessor } from '../src/submissions/ai-review.processor';
import { TeacherToolsService } from '../src/teacher-tools/teacher-tools.service';

type ApiData = {
  token: string;
  refreshToken: string;
  mustChangePassword: boolean;
  id: string;
  _id: string;
  revision: number;
  status: string;
  content: string;
  submissionCount: number;
  code?: string;
  newPassword: string;
  items: Array<{ studentId: string; code?: string }>;
  initialCredentials: Array<{ username: string; password: string }>;
};
function data(response: Response): ApiData {
  return (response.body as { data: ApiData }).data;
}
jest.setTimeout(60000);

describe('Security boundaries and submission transitions (real MongoDB)', () => {
  let app: INestApplication<App>;
  let assignments: Model<AssignmentDocument>;
  let submissions: Model<SubmissionDocument>;
  let users: Model<UserDocument>;
  let memberships: Model<ClassMembershipDocument>;
  let cls: ClassDocument;
  let teacher: UserDocument;
  let student: UserDocument;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let otherTeacherToken: string;
  let outsiderToken: string;

  const api = () => request(app.getHttpServer());
  const login = async (username: string, password = '123456') => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ usernameOrStudentId: username, password })
      .expect(201);
    return data(res);
  };
  const register = async (username: string, role: string) => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        username,
        role,
        password: 'audit-pass-1',
        confirmPassword: 'audit-pass-1',
      })
      .expect(201);
    return data(res).token;
  };
  const fixture = async (status = 'published') =>
    assignments.create({
      title: 'Security test assignment',
      description: '<p>Write an answer</p>',
      teacherId: teacher.id,
      teacherName: teacher.name,
      classes: [{ id: cls.id, name: cls.name }],
      status,
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 86400000),
    });
  const submit = (
    assignmentId: string,
    isDraft = false,
    content = '<p>My answer</p>',
  ) =>
    api()
      .post('/api/students/submissions/submit')
      .auth(studentToken, { type: 'bearer' })
      .send({ assignmentId, classId: cls.id, content, isDraft });
  const review = (id: string, revision: number, token = teacherToken) =>
    api()
      .post('/api/teachers/submissions/review')
      .auth(token, { type: 'bearer' })
      .send({
        submissionId: id,
        revision,
        teacherScore: 88,
        teacherReviewContent: '<p>Confirmed</p>',
      });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
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
    assignments = app.get(getModelToken(Assignment.name));
    submissions = app.get(getModelToken(Submission.name));
    users = app.get(getModelToken(User.name));
    memberships = app.get(getModelToken(ClassMembership.name));
    teacher = (await users.findOne({ username: 'teacher1' }))!;
    student = (await users.findOne({ username: 'student1' }))!;
    cls = (await app
      .get<Model<ClassDocument>>(getModelToken(ClassEntity.name))
      .findOne({ teacherId: teacher.id }))!;
    adminToken = (await login('admin')).token;
    teacherToken = (await login('teacher1')).token;
    studentToken = (await login('student1')).token;
    otherTeacherToken = await register('security-other-teacher', 'teacher');
    outsiderToken = await register('security-outsider', 'student');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });

  it('rejects cross-teacher roster reads while allowing the owner and administrator', async () => {
    const url = `/api/classes/${cls.id}/students`;
    await api()
      .get(url)
      .auth(otherTeacherToken, { type: 'bearer' })
      .expect(403);
    await api().get(url).auth(studentToken, { type: 'bearer' }).expect(403);
    await api().get(url).expect(401);
    for (const token of [teacherToken, adminToken]) {
      const res = await api()
        .get(url)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(
        data(res).items.some(
          (item: { studentId: string }) => item.studentId === student.id,
        ),
      ).toBe(true);
    }
  });

  it('keeps submission filters inside the teacher ownership boundary', async () => {
    const assignment = await fixture();
    const submission = data(await submit(assignment.id).expect(201));
    await api()
      .get('/api/teachers/submissions/list')
      .query({ assignmentId: assignment.id })
      .auth(otherTeacherToken, { type: 'bearer' })
      .expect(403);
    await api()
      .get(`/api/teachers/submissions/detail/${submission.id}`)
      .auth(otherTeacherToken, { type: 'bearer' })
      .expect(403);
    await review(submission.id, submission.revision, otherTeacherToken).expect(
      403,
    );
    for (const token of [teacherToken, adminToken]) {
      const res = await api()
        .get('/api/teachers/submissions/list')
        .query({ assignmentId: assignment.id })
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(data(res).items).toHaveLength(1);
    }
  });

  it('never exposes an invite code to students, including existing members', async () => {
    await api()
      .get(`/api/classes/${cls.id}`)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(403);
    await api()
      .get(`/api/classes/${cls.id}`)
      .auth(otherTeacherToken, { type: 'bearer' })
      .expect(403);
    const member = await api()
      .get(`/api/classes/${cls.id}`)
      .auth(studentToken, { type: 'bearer' })
      .expect(200);
    expect(data(member).code).toBeUndefined();
    const list = await api()
      .get('/api/classes/list')
      .auth(studentToken, { type: 'bearer' })
      .expect(200);
    expect(
      data(list).items.every(
        (item: { code?: string }) => item.code === undefined,
      ),
    ).toBe(true);
    const owner = await api()
      .get(`/api/classes/${cls.id}`)
      .auth(teacherToken, { type: 'bearer' })
      .expect(200);
    expect(data(owner).code).toBe(cls.code);
  });

  it('applies the same membership and draft visibility rules to both student detail routes', async () => {
    const assignment = await fixture();
    for (const route of ['student/assignments', 'students/submissions/my']) {
      await api()
        .get(`/api/${route}/${assignment.id}`)
        .auth(outsiderToken, { type: 'bearer' })
        .expect(403);
      await api()
        .get(`/api/${route}/${assignment.id}`)
        .auth(studentToken, { type: 'bearer' })
        .expect(200);
    }
    assignment.status = 'draft';
    await assignment.save();
    for (const route of ['student/assignments', 'students/submissions/my']) {
      await api()
        .get(`/api/${route}/${assignment.id}`)
        .auth(studentToken, { type: 'bearer' })
        .expect(403);
    }
  });

  it('revokes submission-page access when class membership becomes inactive', async () => {
    const assignment = await fixture();
    await memberships.updateOne(
      { classId: cls.id, studentId: student.id },
      { status: 'inactive' },
    );
    try {
      await api()
        .get(`/api/students/submissions/my/${assignment.id}`)
        .auth(studentToken, { type: 'bearer' })
        .expect(403);
    } finally {
      await memberships.updateOne(
        { classId: cls.id, studentId: student.id },
        { status: 'active' },
      );
    }
  });

  it('preserves a confirmed score when a student tries to save a draft or resubmit', async () => {
    const assignment = await fixture();
    const submission = data(await submit(assignment.id).expect(201));
    await review(submission.id, submission.revision).expect(201);
    await submit(assignment.id, true, 'overwrite').expect(400);
    await submit(assignment.id, false, 'overwrite').expect(400);
    const saved = (await submissions.findById(submission.id))!;
    expect(saved.status).toBe('teacher_reviewed');
    expect(saved.teacherScore).toBe(88);
    expect(saved.content).toBe('<p>My answer</p>');
    expect(saved.teacherReviewHistory).toHaveLength(1);
  });

  it('allows draft edits then two submissions, without resetting the limit through drafts', async () => {
    const assignment = await fixture();
    await submit(assignment.id, true).expect(201);
    await submit(assignment.id, true, 'new draft').expect(201);
    const first = data(await submit(assignment.id).expect(201));
    expect(first.submissionCount).toBe(1);
    await submit(assignment.id, true).expect(400);
    const second = data(
      await submit(assignment.id, false, 'second').expect(201),
    );
    expect(second.submissionCount).toBe(2);
    await submit(assignment.id).expect(400);
    await submit(assignment.id, true).expect(400);
    await api()
      .post('/api/students/submissions/delete')
      .auth(studentToken, { type: 'bearer' })
      .send({ submissionId: second.id })
      .expect(403);
  });

  it('rejects stale teacher reviews after resubmission and requires a revision', async () => {
    const assignment = await fixture();
    const first = data(await submit(assignment.id).expect(201));
    const second = data(
      await submit(assignment.id, false, 'second').expect(201),
    );
    await review(first.id, first.revision).expect(409);
    await api()
      .post('/api/teachers/submissions/review')
      .auth(teacherToken, { type: 'bearer' })
      .send({
        submissionId: first.id,
        teacherScore: 88,
        teacherReviewContent: 'stale',
      })
      .expect(400);
    await review(second.id, second.revision).expect(201);
    expect((await submissions.findById(first.id))!.teacherScore).toBe(88);
  });

  it('does not accept both concurrent requests for the remaining submission attempt', async () => {
    const assignment = await fixture();
    const first = data(await submit(assignment.id).expect(201));
    const results = await Promise.all([
      submit(assignment.id, false, 'second A'),
      submit(assignment.id, false, 'second B'),
    ]);
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    expect(results.every((res) => [201, 400, 409].includes(res.status))).toBe(
      true,
    );
    expect((await submissions.findById(first.id))!.submissionCount).toBe(2);
  });

  it('cleans student submissions, assignment materials and teacher feedback on write', async () => {
    const attack =
      '<p><b>正文</b></p><img src=x onerror="alert(1)"><script>alert(1)</script>';
    const assignment = await fixture();
    assignment.description = attack;
    assignment.questionMaterial = { content: attack };
    await assignment.save();
    expect(assignment.description).not.toMatch(/onerror|script/);
    expect(assignment.questionMaterial.content).not.toMatch(/onerror|script/);
    const sub = data(await submit(assignment.id, false, attack).expect(201));
    expect(sub.content).toContain('<b>正文</b>');
    expect(sub.content).not.toMatch(/onerror|script/);
    await api()
      .post('/api/teachers/submissions/review')
      .auth(teacherToken, { type: 'bearer' })
      .send({
        submissionId: sub.id,
        revision: sub.revision,
        teacherScore: 80,
        teacherReviewContent: attack,
      })
      .expect(201);
    expect(
      (await submissions.findById(sub.id))!.teacherReviewContent,
    ).not.toMatch(/onerror|script/);
  });

  function worker(callback: () => Promise<unknown>) {
    return new AiReviewProcessor(
      submissions,
      assignments,
      { updateOne: jest.fn() } as never,
      memberships,
      users,
      { review: callback } as never,
    );
  }
  const job = (sub: { id: string; revision: number }) =>
    ({
      id: 'security-job',
      data: { submissionId: sub.id, revision: sub.revision },
    }) as Job<{ submissionId: string; revision: number }>;

  it('discards AI jobs for drafts, reviewed work, completed work and superseded revisions', async () => {
    const assignment = await fixture();
    const draft = data(await submit(assignment.id, true).expect(201));
    const call = jest
      .fn()
      .mockResolvedValue({ success: true, score: 40, review: 'AI' });
    const processor = worker(call);
    await processor.process(job(draft));
    expect(call).not.toHaveBeenCalled();
    const first = data(await submit(assignment.id).expect(201));
    const second = data(
      await submit(assignment.id, false, 'second').expect(201),
    );
    await processor.process(job(first));
    expect(call).not.toHaveBeenCalled();
    await processor.process(job(second));
    expect(call).toHaveBeenCalledTimes(1);
    await processor.process(job(second));
    expect(call).toHaveBeenCalledTimes(1);
    await review(second.id, second.revision).expect(201);
    await processor.process(job(second));
    expect(call).toHaveBeenCalledTimes(1);
    expect((await submissions.findById(second.id))!.status).toBe(
      'teacher_reviewed',
    );
  });

  it.each(['success', 'failure'])(
    'preserves manual review while an AI %s arrives late',
    async (outcome) => {
      const assignment = await fixture();
      const sub = data(await submit(assignment.id).expect(201));
      const processor = worker(async () => {
        await review(sub.id, sub.revision).expect(201);
        if (outcome === 'failure') throw new Error('network failed');
        return { success: true, score: 42, review: 'late AI' };
      });
      await processor.process(job(sub));
      const saved = (await submissions.findById(sub.id))!;
      expect(saved.status).toBe('teacher_reviewed');
      expect(saved.teacherScore).toBe(88);
      expect(saved.aiScore).toBeNull();
    },
  );

  it('discards the result when a new submission arrives during an AI request', async () => {
    const assignment = await fixture();
    const first = data(await submit(assignment.id).expect(201));
    await worker(async () => {
      await submit(assignment.id, false, 'new content').expect(201);
      return { success: true, score: 42, review: 'old content grade' };
    }).process(job(first));
    const saved = (await submissions.findById(first.id))!;
    expect(saved.content).toBe('new content');
    expect(saved.aiScore).toBeNull();
    expect(saved.revision).toBe(first.revision + 1);
  });

  it('does not apply unversioned legacy jobs to new or reviewed submissions', async () => {
    const assignment = await fixture();
    const sub = data(await submit(assignment.id).expect(201));
    const call = jest.fn();
    const processor = worker(call);
    const legacyJob = { id: 'old-job', data: { submissionId: sub.id } } as Job<{
      submissionId: string;
    }>;
    await processor.process(legacyJob);
    expect((await submissions.findById(sub.id))!.status).toBe('submitted');
    // Simulate an existing row that predates the revision field.
    await submissions.collection.updateOne(
      { _id: (await submissions.findById(sub.id))!._id },
      { $unset: { revision: '' } },
    );
    await processor.process(legacyJob);
    expect((await submissions.findById(sub.id))!.status).toBe(
      'ai_review_failed',
    );
    await review(sub.id, 0).expect(201);
    await processor.process(legacyJob);
    expect((await submissions.findById(sub.id))!.teacherScore).toBe(88);
    expect(call).not.toHaveBeenCalled();
  });

  it('does not let a stalled older worker overwrite the newer worker result', async () => {
    const assignment = await fixture();
    const sub = data(await submit(assignment.id).expect(201));
    let started!: () => void;
    let finish!: (value: unknown) => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const older = worker(async () => {
      started();
      return pending;
    }).process(job(sub));
    await entered;
    await worker(() =>
      Promise.resolve({
        success: true,
        score: 75,
        review: 'new worker',
      }),
    ).process(job(sub));
    finish({ success: true, score: 42, review: 'old worker' });
    await older;
    const saved = (await submissions.findById(sub.id))!;
    expect(saved.aiScore).toBe(75);
    expect(saved.aiReviewContent).toBe('new worker');
  });

  it('refuses a student write when manual review wins the database race', async () => {
    const assignment = await fixture();
    const sub = data(await submit(assignment.id).expect(201));
    const original: unknown = submissions.findOneAndUpdate.bind(submissions);
    jest.spyOn(submissions, 'findOneAndUpdate').mockImplementationOnce(
      (...args: unknown[]) =>
        ({
          then: async (
            resolve: (value: unknown) => void,
            reject: (error: unknown) => void,
          ) => {
            try {
              await review(sub.id, sub.revision).expect(201);
              resolve(
                await (original as (...args: unknown[]) => Promise<unknown>)(
                  ...args,
                ),
              );
            } catch (error) {
              reject(error);
            }
          },
        }) as never,
    );
    await submit(assignment.id, false, 'racing overwrite').expect(409);
    const saved = (await submissions.findById(sub.id))!;
    expect(saved.teacherScore).toBe(88);
    expect(saved.content).toBe('<p>My answer</p>');
  });

  it('protects teacher scores when teacher-tools sync races with manual review', async () => {
    const assignment = await fixture();
    const sub = data(await submit(assignment.id).expect(201));
    const original: unknown = submissions.findOneAndUpdate.bind(submissions);
    jest.spyOn(submissions, 'findOneAndUpdate').mockImplementationOnce(
      (...args: unknown[]) =>
        ({
          then: async (
            resolve: (value: unknown) => void,
            reject: (error: unknown) => void,
          ) => {
            try {
              await review(sub.id, sub.revision).expect(201);
              resolve(
                await (original as (...args: unknown[]) => Promise<unknown>)(
                  ...args,
                ),
              );
            } catch (error) {
              reject(error);
            }
          },
        }) as never,
    );
    const service = app.get(TeacherToolsService);
    const result = await (
      service as unknown as {
        syncItemToSubmission(
          task: unknown,
          item: unknown,
        ): Promise<{ reason: string }>;
      }
    ).syncItemToSubmission(
      {
        id: 'tool-test',
        type: 'essay_batch',
        assignmentId: assignment.id,
        classId: cls.id,
        className: cls.name,
        config: { syncToSubmissions: true, overwriteExistingSubmissions: true },
      },
      {
        matchedStudent: {
          status: 'matched',
          studentId: student.id,
          classId: cls.id,
        },
        essayText: 'tool content',
        score: 40,
      },
    );
    expect(result.reason).toBe('submission_changed');
    expect((await submissions.findById(sub.id))!.teacherScore).toBe(88);
  });

  it('blocks initial-password accounts across business APIs, including refreshed tokens', async () => {
    const res = await api()
      .post('/api/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        username: 'initial-password-teacher',
        name: 'Initial Teacher',
        role: 'teacher',
        password: 'initial-pass',
      })
      .expect(201);
    const session = await login('initial-password-teacher', 'initial-pass');
    expect(session.mustChangePassword).toBe(true);
    for (const url of [
      '/api/classes/list',
      '/api/users/ai-settings',
      '/api/teacher/tools/tasks',
      '/api/teachers/submissions/list',
      '/api/permissions/user-roles/users/current/resources',
    ]) {
      const denied = await api()
        .get(url)
        .auth(session.token, { type: 'bearer' })
        .expect(403);
      expect((denied.body as { errorCode: string }).errorCode).toBe(
        'PASSWORD_CHANGE_REQUIRED',
      );
    }
    await api()
      .get('/api/v1/auth/profile')
      .auth(session.token, { type: 'bearer' })
      .expect(200);
    const refreshed = await api()
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: session.refreshToken })
      .expect(201);
    await api()
      .get('/api/classes/list')
      .auth(data(refreshed).token, { type: 'bearer' })
      .expect(403);
    await api()
      .put('/api/v1/auth/first-password-change')
      .auth(session.token, { type: 'bearer' })
      .send({
        currentPassword: 'initial-pass',
        newPassword: 'initial-pass',
        confirmPassword: 'initial-pass',
      })
      .expect(400);
    await api()
      .put('/api/v1/auth/first-password-change')
      .auth(session.token, { type: 'bearer' })
      .send({
        currentPassword: 'initial-pass',
        newPassword: 'changed-pass',
        confirmPassword: 'changed-pass',
      })
      .expect(200);
    await api()
      .get('/api/classes/list')
      .auth(session.token, { type: 'bearer' })
      .expect(401);
    const changed = await login('initial-password-teacher', 'changed-pass');
    await api()
      .get('/api/classes/list')
      .auth(changed.token, { type: 'bearer' })
      .expect(200);
    expect((await users.findById(data(res)._id))!.mustChangePassword).toBe(
      false,
    );
  });

  it('generates distinct reset/import credentials and still requires password change', async () => {
    const imported = await api()
      .post('/api/users/batch-import')
      .auth(adminToken, { type: 'bearer' })
      .send([
        { username: 'random-initial-a', name: 'A', role: 'student' },
        { username: 'random-initial-b', name: 'B', role: 'student' },
      ])
      .expect(201);
    const credentials = data(imported).initialCredentials;
    expect(credentials).toHaveLength(2);
    expect(credentials[0].password).not.toBe(credentials[1].password);
    expect(credentials[0].password.length).toBeGreaterThanOrEqual(20);
    const initial = await login(
      credentials[0].username,
      credentials[0].password,
    );
    expect(initial.mustChangePassword).toBe(true);
    await api()
      .post('/api/v1/auth/logout')
      .auth(initial.token, { type: 'bearer' })
      .expect(201);
    const target = (await users.findOne({
      username: credentials[0].username,
    }))!;
    const reset = await api()
      .post(`/api/users/${target.id}/reset-password`)
      .auth(adminToken, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(data(reset).newPassword).not.toBe('123456');
    expect(data(reset).newPassword).not.toBe(credentials[0].password);
    const session = await login(target.username, data(reset).newPassword);
    await api()
      .put('/api/users/password')
      .auth(session.token, { type: 'bearer' })
      .send({
        currentPassword: data(reset).newPassword,
        newPassword: 'changed-through-users',
      })
      .expect(200);
    expect(
      (await login(target.username, 'changed-through-users'))
        .mustChangePassword,
    ).toBe(false);
  });
});
