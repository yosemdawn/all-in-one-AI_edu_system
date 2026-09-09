import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppService } from '../src/app.service';
import { SubmissionsService } from '../src/submissions/submissions.service';
import {
  Submission,
  SubmissionDocument,
} from '../src/submissions/schemas/submission.schema';
import {
  Assignment,
  AssignmentDocument,
} from '../src/assignments/schemas/assignment.schema';
import {
  ClassEntity,
  ClassDocument,
} from '../src/classes/schemas/class.schema';
import { ClassMembership } from '../src/classes/schemas/class-membership.schema';
import { User } from '../src/users/schemas/user.schema';
import { AiReviewConfigService } from '../src/submissions/ai-review-config.service';
import {
  AiReviewDispatchService,
  pendingAiDispatch,
} from '../src/submissions/ai-review-dispatch.service';
import { AiReviewProcessor } from '../src/submissions/ai-review.processor';
import { Job } from 'bullmq';

jest.setTimeout(60000);
describe('Operational failure recovery and real HTTP limits', () => {
  let app: INestApplication<App>;
  let submissions: Model<SubmissionDocument>;
  let assignments: Model<AssignmentDocument>;
  let dispatcher: AiReviewDispatchService;
  let cls: ClassDocument;
  let teacherId: string;
  let studentId: string;
  let studentToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  const queue = { ensureReview: jest.fn<Promise<string>, [string, number]>() };
  const api = () => request(app.getHttpServer());
  type Data = {
    id: string;
    revision: number;
    submissionCount: number;
    token: string;
    status: string;
  };
  const data = (res: { body: unknown }) => (res.body as { data: Data }).data;
  const fixture = async () =>
    assignments.create({
      title: 'Recovery test',
      description: 'Write an answer',
      teacherId,
      teacherName: 'Teacher',
      classes: [{ id: cls.id, name: cls.name }],
      status: 'published',
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 86400000),
    });
  const submit = (assignmentId: string) =>
    api()
      .post('/api/students/submissions/submit')
      .auth(studentToken, { type: 'bearer' })
      .send({ assignmentId, classId: cls.id, content: 'Answer' });
  const retry = (id: string, revision: number, token = teacherToken) =>
    api()
      .post('/api/teachers/submissions/retry-ai')
      .auth(token, { type: 'bearer' })
      .send({ submissionId: id, revision });
  const due = (id: string) =>
    submissions.updateOne(
      { _id: id },
      { $set: { 'aiDispatch.nextAttemptAt': new Date(0) } },
    );

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = '25';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SubmissionsService)
      .useFactory({
        inject: [
          getModelToken(Submission.name),
          getModelToken(Assignment.name),
          getModelToken(ClassEntity.name),
          getModelToken(ClassMembership.name),
          getModelToken(User.name),
          AppService,
          AiReviewConfigService,
        ],
        factory: (
          ...args: ConstructorParameters<typeof SubmissionsService>
        ) => {
          dispatcher = new AiReviewDispatchService(args[0], queue as never);
          return new SubmissionsService(
            ...(args.slice(0, 7) as [
              (typeof args)[0],
              (typeof args)[1],
              (typeof args)[2],
              (typeof args)[3],
              (typeof args)[4],
              (typeof args)[5],
              (typeof args)[6],
            ]),
            undefined,
            dispatcher,
          );
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    submissions = app.get(getModelToken(Submission.name));
    assignments = app.get(getModelToken(Assignment.name));
    const users = app.get<Model<User>>(getModelToken(User.name));
    teacherId = (await users.findOne({ username: 'teacher1' }))!.id;
    studentId = (await users.findOne({ username: 'student1' }))!.id;
    cls = (await app
      .get<Model<ClassDocument>>(getModelToken(ClassEntity.name))
      .findOne({ teacherId }))!;
    for (const username of ['teacher1', 'student1']) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ usernameOrStudentId: username, password: '123456' })
        .expect(201);
      if (username === 'teacher1') teacherToken = data(res).token;
      else studentToken = data(res).token;
    }
    otherTeacherToken = data(
      await api()
        .post('/api/v1/auth/register')
        .send({
          username: 'recovery-other',
          role: 'teacher',
          password: 'recovery-pass',
          confirmPassword: 'recovery-pass',
        })
        .expect(201),
    ).token;
  });
  beforeEach(() => {
    queue.ensureReview.mockReset().mockResolvedValue('waiting');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    delete process.env.THROTTLE_LIMIT;
    await app?.close();
  });

  it('accepts a submission during Redis outage and recovers its persisted dispatch after restart', async () => {
    queue.ensureReview.mockRejectedValue(new Error('Redis offline'));
    const item = data(await submit((await fixture()).id).expect(201));
    let row = (await submissions.findById(item.id))!;
    expect(row.submissionCount).toBe(1);
    expect(row.aiDispatch?.state).toBe('pending');
    expect(row.status).toBe('ai_review_queued');
    queue.ensureReview.mockResolvedValue('waiting');
    await due(item.id);
    const restarted = new AiReviewDispatchService(submissions, queue as never);
    await restarted.sweep();
    row = (await submissions.findById(item.id))!;
    expect(row.aiDispatch?.state).toBe('queued');
    expect(row.submissionCount).toBe(1);
  });

  it('recovers termination immediately after the database commit, and leases concurrent deliveries once', async () => {
    jest
      .spyOn(dispatcher, 'deliver')
      .mockRejectedValue(new Error('process terminated'));
    const item = data(await submit((await fixture()).id).expect(201));
    expect(queue.ensureReview).not.toHaveBeenCalled();
    const restarted = new AiReviewDispatchService(submissions, queue as never);
    await Promise.all([
      restarted.deliver(item.id, item.revision),
      restarted.deliver(item.id, item.revision),
    ]);
    expect(queue.ensureReview).toHaveBeenCalledTimes(1);
  });

  it.each(['failed', 'completed'])(
    'marks orphaned %s jobs failed and permits one teacher retry without changing submission count',
    async (state) => {
      const item = data(await submit((await fixture()).id).expect(201));
      queue.ensureReview.mockResolvedValue(state);
      await due(item.id);
      await dispatcher.deliver(item.id, item.revision);
      expect((await submissions.findById(item.id))?.status).toBe(
        'ai_review_failed',
      );
      await retry(item.id, item.revision, otherTeacherToken).expect(403);
      await retry(item.id, item.revision, studentToken).expect(403);
      await api()
        .post('/api/teachers/submissions/retry-ai')
        .send({ submissionId: item.id, revision: item.revision })
        .expect(401);
      queue.ensureReview.mockResolvedValue('waiting');
      const outcomes = await Promise.all([
        retry(item.id, item.revision),
        retry(item.id, item.revision),
      ]);
      expect(outcomes.map((res) => res.status).sort()).toEqual([201, 409]);
      const updated = (await submissions.findById(item.id))!;
      expect(updated.revision).toBe(item.revision + 1);
      expect(updated.submissionCount).toBe(1);
    },
  );

  it('expires stuck tasks even while Redis is offline, and rejects late worker results', async () => {
    const item = data(await submit((await fixture()).id).expect(201));
    await submissions.updateOne(
      { _id: item.id },
      {
        $set: {
          'aiDispatch.requestedAt': new Date(0),
          'aiDispatch.nextAttemptAt': new Date(0),
        },
      },
    );
    queue.ensureReview.mockRejectedValue(new Error('Redis offline'));
    await dispatcher.deliver(item.id, item.revision);
    expect((await submissions.findById(item.id))?.status).toBe(
      'ai_review_failed',
    );
    const ai = { review: jest.fn() };
    const processor = new AiReviewProcessor(
      submissions,
      assignments,
      {} as never,
      {} as never,
      {} as never,
      ai as never,
    );
    await processor.process({
      data: { submissionId: item.id, revision: item.revision },
    } as Job<{ submissionId: string; revision: number }>);
    expect(ai.review).not.toHaveBeenCalled();
  });

  it('protects manual scores during a delayed dispatch response', async () => {
    const item = data(await submit((await fixture()).id).expect(201));
    await due(item.id);
    queue.ensureReview.mockImplementation(async () => {
      await api()
        .post('/api/teachers/submissions/review')
        .auth(teacherToken, { type: 'bearer' })
        .send({
          submissionId: item.id,
          revision: item.revision,
          teacherScore: 91,
          teacherReviewContent: 'Confirmed',
        })
        .expect(201);
      return 'failed';
    });
    await dispatcher.deliver(item.id, item.revision);
    const row = (await submissions.findById(item.id))!;
    expect(row.teacherScore).toBe(91);
    expect(row.status).toBe('teacher_reviewed');
    await retry(item.id, row.revision).expect(409);
  });

  it('records intermediate failures for automatic retry and makes exhausted failure terminal', async () => {
    const item = data(await submit((await fixture()).id).expect(201));
    const processor = new AiReviewProcessor(
      submissions,
      assignments,
      {} as never,
      {} as never,
      {
        findById: () => ({
          select: () => ({ lean: () => Promise.resolve({}) }),
        }),
      } as never,
      { review: () => Promise.reject(new Error('AI timed out')) } as never,
    );
    const job = {
      data: { submissionId: item.id, revision: item.revision },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as Job<{ submissionId: string; revision: number }>;
    await expect(processor.process(job)).rejects.toThrow('AI timed out');
    expect((await submissions.findById(item.id))?.aiDispatch?.state).toBe(
      'queued',
    );
    await retry(item.id, item.revision).expect(409);
    job.attemptsMade = 2;
    await expect(processor.process(job)).rejects.toThrow('AI timed out');
    expect((await submissions.findById(item.id))?.aiDispatch?.state).toBe(
      'done',
    );
  });

  it('does not dispatch drafts or manually reviewed rows even if their dispatch metadata is pending', async () => {
    const assignment = await fixture();
    const row = await submissions.create({
      assignmentId: assignment.id,
      studentId,
      studentName: 'Student',
      classId: cls.id,
      className: cls.name,
      content: 'draft',
      isDraft: true,
      revision: 1,
      aiDispatch: pendingAiDispatch(),
    });
    await dispatcher.deliver(row.id, 1);
    expect(queue.ensureReview).not.toHaveBeenCalled();
    await retry(row.id, 1).expect(409);
    await submissions.updateOne(
      { _id: row.id },
      { $set: { isDraft: false, status: 'ai_reviewed', aiScore: 80 } },
    );
    await dispatcher.deliver(row.id, 1);
    expect(queue.ensureReview).not.toHaveBeenCalled();
    expect((await submissions.findById(row.id))?.aiScore).toBe(80);
  });

  it('isolates user limits behind one IP, ignores forged forwarding headers, and exempts probes', async () => {
    app.get(ConfigService).set('NODE_ENV', 'development'); // Enable the actual global guard after fixture creation.
    for (let i = 0; i < 25; i++) {
      await api()
        .get('/api/v1/auth/profile')
        .auth(studentToken, { type: 'bearer' })
        .expect(200);
      await api()
        .get('/api/v1/auth/profile')
        .auth(teacherToken, { type: 'bearer' })
        .expect(200);
    }
    await api()
      .get('/api/v1/auth/profile')
      .auth(studentToken, { type: 'bearer' })
      .set('X-Forwarded-For', '203.0.113.5')
      .expect(429);
    for (let i = 0; i < 15; i++) await api().get('/api/').expect(200);
    for (let i = 0; i < 30; i++) await api().get('/api/healthz').expect(200);
    await api().get('/api/readyz').expect(200);
    for (let i = 0; i < 5; i++)
      await api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .send({ usernameOrStudentId: 'missing', password: 'bad-password' })
        .expect(401);
    await api()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.250')
      .send({ usernameOrStudentId: 'missing', password: 'bad-password' })
      .expect(429);
  });
});
