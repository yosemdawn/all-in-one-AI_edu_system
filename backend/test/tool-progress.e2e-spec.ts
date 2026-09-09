import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  ToolTask,
  ToolTaskDocument,
} from '../src/teacher-tools/schemas/tool-task.schema';
import { TeacherToolsService } from '../src/teacher-tools/teacher-tools.service';
import { DoubaoVisionService } from '../src/teacher-tools/doubao-vision.service';
import { User } from '../src/users/schemas/user.schema';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
jest.setTimeout(60000);
describe('Tool progress persisted while AI calls are in flight', () => {
  let app: INestApplication<App>;
  let tasks: Model<ToolTaskDocument>;
  let service: TeacherToolsService;
  let teacherId: string;
  let token: string;
  const vision = {
    recognizeAnswerCard: jest.fn(),
    reviewEssay: jest.fn(),
    previewEssayRequirements: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DoubaoVisionService)
      .useValue(vision)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    tasks = app.get(getModelToken(ToolTask.name));
    service = app.get(TeacherToolsService);
    teacherId = (await app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ username: 'teacher1' }))!.id;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrStudentId: 'teacher1', password: '123456' })
      .expect(201);
    token = (login.body as { data: { token: string } }).data.token;
  });
  beforeEach(() => {
    Object.values(vision).forEach((mock) => mock.mockReset());
  });
  afterAll(async () => {
    await app?.close();
  });
  const detail = async (id: string) => {
    const res = await request(app.getHttpServer())
      .get(`/api/teacher/tools/tasks/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    return (res.body as { data: ToolTask }).data;
  };
  const create = (type: 'objective_grading' | 'essay_batch') => {
    const files = [1, 2].map((n) => ({
      originalName: 'same-name.png',
      path: `/test/${n}.png`,
      mimeType: 'image/png',
      size: 10,
    }));
    return tasks.create({
      type,
      teacherId,
      teacherName: 'Teacher',
      title: 'Progress test',
      totalCount: 2,
      config:
        type === 'objective_grading'
          ? { files, standardAnswers: { '1': 'A' } }
          : { essayImages: files, requirementImages: [files[0]] },
    });
  };
  it.each(['objective_grading', 'essay_batch'] as const)(
    '%s exposes the active file before it completes and counts successes/failures',
    async (type) => {
      const task = await create(type);
      const first = deferred<unknown>();
      const firstStarted = deferred<void>();
      const second = deferred<unknown>();
      const secondStarted = deferred<void>();
      const requirements = deferred<unknown>();
      const requirementsStarted = deferred<void>();
      vision.previewEssayRequirements.mockImplementation(() => {
        requirementsStarted.resolve();
        return requirements.promise;
      });
      const mock =
        type === 'objective_grading'
          ? vision.recognizeAnswerCard
          : vision.reviewEssay;
      mock
        .mockImplementationOnce(() => {
          firstStarted.resolve();
          return first.promise;
        })
        .mockImplementationOnce(() => {
          secondStarted.resolve();
          return second.promise;
        });
      const processing = service.processTask(task.id);
      if (type === 'essay_batch') {
        await requirementsStarted.promise;
        expect((await detail(task.id)).progress?.stage).toBe('requirements');
        requirements.resolve({ data: { requirements: 'Write an essay' } });
      }
      await firstStarted.promise;
      const active = await detail(task.id);
      expect(active.processedCount).toBe(0);
      expect(active.progress?.currentIndex).toBe(1);
      expect(active.progress?.currentFileName).toBe('same-name.png');
      expect(active.progress?.stage).toBe(
        type === 'objective_grading' ? 'recognizing' : 'reviewing',
      );
      expect(active.startedAt).toBeTruthy();
      first.resolve({
        data: { answers: { '1': 'A' }, score: 80 },
        rawContent: '{}',
      });
      await secondStarted.promise;
      const midway = await detail(task.id);
      expect(midway.processedCount).toBe(1);
      expect(midway.successCount).toBe(1);
      expect(midway.progress?.currentIndex).toBe(2);
      second.reject(new Error('Sample AI failure'));
      await processing;
      const completed = await detail(task.id);
      expect(completed.status).toBe('partial_failed');
      expect(completed.processedCount).toBe(2);
      expect(completed.successCount).toBe(1);
      expect(completed.failureCount).toBe(1);
      expect(completed.items).toHaveLength(2);
    },
  );
  it('keeps cancellation visible when a pending AI call subsequently fails', async () => {
    const task = await create('objective_grading');
    const pending = deferred<unknown>();
    const started = deferred<void>();
    vision.recognizeAnswerCard.mockImplementation(() => {
      started.resolve();
      return pending.promise;
    });
    const processing = service.processTask(task.id);
    await started.promise;
    await request(app.getHttpServer())
      .post(`/api/teacher/tools/tasks/${task.id}/cancel`)
      .auth(token, { type: 'bearer' })
      .expect(201);
    pending.reject(new Error('Cancelled request'));
    await processing;
    expect((await detail(task.id)).status).toBe('cancelled');
    expect((await detail(task.id)).processedCount).toBe(0);
  });
});
