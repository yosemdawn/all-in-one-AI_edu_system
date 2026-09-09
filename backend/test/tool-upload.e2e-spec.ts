import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, mongo } from 'mongoose';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { request as httpRequest } from 'node:http';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  ToolTask,
  ToolTaskDocument,
} from '../src/teacher-tools/schemas/tool-task.schema';
import { TeacherToolsService } from '../src/teacher-tools/teacher-tools.service';
import { DoubaoVisionService } from '../src/teacher-tools/doubao-vision.service';
import {
  ToolUploadService,
  TOOL_UPLOAD_LIMITS,
} from '../src/teacher-tools/tool-upload.service';
import { User } from '../src/users/schemas/user.schema';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
jest.setTimeout(60_000);
describe('Teacher tool uploads with real multipart requests and isolated storage', () => {
  let app: INestApplication<App>;
  let tasks: Model<ToolTaskDocument>;
  let token: string;
  let teacherId: string;
  let directory: string;
  let storage: string;
  const originalCwd = process.cwd();
  const tempRoot = join(originalCwd, '..', '.temp');
  const vision = { previewEssayRequirements: jest.fn() };

  beforeAll(async () => {
    await mkdir(tempRoot, { recursive: true });
    directory = await mkdtemp(join(tempRoot, 'tool-upload-'));
    process.chdir(directory);
    storage = join(directory, 'uploads', 'teacher-tools');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DoubaoVisionService)
      .useValue(vision)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    tasks = app.get(getModelToken(ToolTask.name));
    // Exercise persistence without starting an AI request or external queue.
    jest
      .spyOn(
        app.get<unknown>(TeacherToolsService) as {
          dispatchTask(id: string): Promise<void>;
        },
        'dispatchTask',
      )
      .mockResolvedValue();
    teacherId = (await app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ username: 'teacher1' }))!.id;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrStudentId: 'teacher1', password: '123456' })
      .expect(201);
    token = (login.body as { data: { token: string } }).data.token;
  });
  beforeEach(async () => {
    vision.previewEssayRequirements
      .mockReset()
      .mockResolvedValue({ data: { requirements: '作文要求' } });
    await tasks.deleteMany({});
  });
  afterEach(async () => {
    expect(await readdir(join(storage, '.incoming'))).toEqual([]);
  });
  afterAll(async () => {
    await app?.close();
    process.chdir(originalCwd);
    // Remove only this test's newly allocated directory.
    if (directory && dirname(directory) === join(originalCwd, '..', '.temp')) {
      await rm(directory, { recursive: true, force: true });
    }
  });
  const post = (route = 'objective-grading/tasks') =>
    request(app.getHttpServer())
      .post(`/api/teacher/tools/${route}`)
      .auth(token, { type: 'bearer' });
  const objective = () => post().field('standardAnswers', '{"1":"A"}');

  it('rejects anonymous and student uploads before storing any files', async () => {
    await request(app.getHttpServer())
      .post('/api/teacher/tools/objective-grading/tasks')
      .attach('answerCards', png, 'answer.png')
      .expect(401);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ usernameOrStudentId: 'student1', password: '123456' })
      .expect(201);
    const studentToken = (login.body as { data: { token: string } }).data.token;
    await request(app.getHttpServer())
      .post('/api/teacher/tools/objective-grading/tasks')
      .auth(studentToken, { type: 'bearer' })
      .attach('answerCards', png, 'answer.png')
      .expect(403);
    expect(await tasks.countDocuments()).toBe(0);
  });

  it.each(['value[999999999]', 'value[a][b]'])(
    'rejects malicious multipart nesting: %s',
    async (field) => {
      await objective()
        .field(field, 'x')
        .attach('answerCards', png, 'answer.png')
        .expect(400);
      expect(await tasks.countDocuments()).toBe(0);
    },
  );

  it.each(['objective-grading', 'essay-batch'])(
    'persists %s originals after temporary files are cleaned',
    async (type) => {
      const field =
        type === 'objective-grading' ? 'answerCards' : 'essayImages';
      const pending = post(`${type}/tasks`).field(
        'standardAnswers',
        '{"1":"A"}',
      );
      if (type === 'essay-batch')
        pending.attach('requirementImages', png, 'question.png');
      const response = await pending
        .attach(field, png, '张小明答卷.png')
        .expect(201);
      const task = await tasks.findById(
        (response.body as { data: { id: string } }).data.id,
      );
      const files: Array<{ path: string; originalName: string }> = task!.config
        .files || [
        ...task!.config.requirementImages,
        ...task!.config.essayImages,
      ];
      for (const file of files) expect(await readFile(file.path)).toEqual(png);
      expect(task!.totalCount).toBe(1);
      expect(files[files.length - 1].originalName).toBe('张小明答卷.png');
    },
  );

  it.each([true, false])(
    'cleans preview images when AI succeeds=%s',
    async (success) => {
      if (!success)
        vision.previewEssayRequirements.mockRejectedValueOnce(
          new Error('AI unavailable'),
        );
      await post('essay-batch/preview-requirements')
        .attach('requirementImages', png, 'question.png')
        .expect(success ? 201 : 500);
      expect(await tasks.countDocuments()).toBe(0);
      await expect(
        readdir(join(storage, 'essay-requirements-preview')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it.each([
    ['image/svg+xml', Buffer.from('<svg/>')],
    ['image/png', Buffer.from('this is not a picture')],
    ['image/jpeg', png],
    ['image/png', Buffer.alloc(0)],
  ])(
    'rejects invalid or disguised image (%s)',
    async (contentType, content) => {
      await objective()
        .attach('answerCards', content, { filename: 'fake.png', contentType })
        .expect(400);
      expect(await tasks.countDocuments()).toBe(0);
    },
  );

  it('rejects a file over 15 MiB and removes partially received bytes', async () => {
    await objective()
      .attach(
        'answerCards',
        Buffer.alloc(TOOL_UPLOAD_LIMITS.fileBytes + 1),
        'large.png',
      )
      .expect(413);
    expect(await tasks.countDocuments()).toBe(0);
  });

  it('enforces the combined 40 MiB limit while receiving mixed essay fields', async () => {
    const large = Buffer.alloc(15 * 1024 * 1024);
    await post('essay-batch/tasks')
      .attach('requirementImages', large, 'question.png')
      .attach('essayImages', large, 'one.png')
      .attach('essayImages', large, 'two.png')
      .expect(413);
    expect(await tasks.countDocuments()).toBe(0);
  });

  it('allows 100 small answer cards and rejects a sixth requirement image', async () => {
    const batch = objective();
    for (let n = 0; n < 100; n++) batch.attach('answerCards', png, `${n}.png`);
    await batch.expect(201);
    const preview = post('essay-batch/preview-requirements');
    for (let n = 0; n < 6; n++)
      preview.attach('requirementImages', png, `${n}.png`);
    await preview.expect(400);
    expect(await tasks.countDocuments()).toBe(1);
  });

  it('cleans incoming files when business validation fails', async () => {
    await post().attach('answerCards', png, 'answer.png').expect(400);
    expect(await tasks.countDocuments()).toBe(0);
  });

  it.each(['objective-grading', 'essay-batch'])(
    'removes %s copies if the database explicitly rejects the document',
    async (type) => {
      const folder = join(storage, type);
      const before = await readdir(folder).catch(() => []);
      const spy = jest.spyOn(tasks, 'create').mockRejectedValueOnce(
        new mongo.MongoServerError({
          code: 121,
          message: 'document rejected',
        }),
      );
      try {
        const field =
          type === 'objective-grading' ? 'answerCards' : 'essayImages';
        await post(`${type}/tasks`)
          .field('standardAnswers', '{"1":"A"}')
          .attach(field, png, 'answer.png')
          .expect(500);
      } finally {
        spy.mockRestore();
      }
      expect(await readdir(folder)).toEqual(before);
    },
  );

  it('limits storage per teacher without counting another teacher’s files', async () => {
    const quotaTask = await tasks.create({
      type: 'essay_batch',
      title: 'quota',
      teacherId: 'someone-else',
      teacherName: 'Other',
      config: {
        essayImages: [{ size: TOOL_UPLOAD_LIMITS.teacherBytes }],
      },
    });
    await objective().attach('answerCards', png, 'answer.png').expect(201);
    await tasks.updateOne({ _id: quotaTask._id }, { $set: { teacherId } });
    await objective().attach('answerCards', png, 'answer.png').expect(413);
  });

  it('recovers a saved task after a lost write acknowledgement without deleting its images', async () => {
    const spy = jest
      .spyOn(tasks, 'create')
      .mockImplementationOnce(async (data: Partial<ToolTask>) => {
        await new tasks(data).save();
        throw new mongo.MongoNetworkError('write acknowledgement lost');
      });
    let id: string;
    try {
      const response = await objective()
        .attach('answerCards', png, 'saved.png')
        .expect(201);
      id = (response.body as { data: { id: string } }).data.id;
    } finally {
      spy.mockRestore();
    }
    const task = await tasks.findById(id!);
    const files = task!.config.files as Array<{ path: string }>;
    expect(await readFile(files[0].path)).toEqual(png);
    expect(await tasks.countDocuments()).toBe(1);
  });

  it('asks duplicate uploads to wait and releases the slot after preview finishes', async () => {
    let finish!: () => void;
    let started!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      started = resolve;
    });
    vision.previewEssayRequirements.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        finish = () => resolve({ data: { requirements: 'done' } });
      });
    });
    const first = post('essay-batch/preview-requirements')
      .attach('requirementImages', png, 'one.png')
      .then((response) => response);
    await inFlight;
    try {
      await objective().attach('answerCards', png, 'two.png').expect(429);
    } finally {
      finish();
      await first;
    }
    await objective().attach('answerCards', png, 'three.png').expect(201);
  });

  it('cleans incomplete streams when the browser disconnects', async () => {
    const client = httpRequest(
      `${await app.getUrl()}/api/teacher/tools/objective-grading/tasks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data; boundary=upload-test',
        },
      },
    );
    client.on('error', () => undefined);
    client.write(
      '--upload-test\r\nContent-Disposition: form-data; name="answerCards"; filename="partial.png"\r\nContent-Type: image/png\r\n\r\n',
    );
    client.write(Buffer.alloc(8192));
    const waitUntil = async (condition: () => Promise<boolean>) => {
      const deadline = Date.now() + 5000;
      while (!(await condition())) {
        if (Date.now() > deadline) throw new Error('Upload cleanup timed out');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    try {
      await waitUntil(
        async () => (await readdir(join(storage, '.incoming'))).length > 0,
      );
    } finally {
      client.destroy();
    }
    await waitUntil(
      async () => (await readdir(join(storage, '.incoming'))).length === 0,
    );
    await objective().attach('answerCards', png, 'retry.png').expect(201);
  });

  it('cleans stale temporary files while retaining recent files and business originals', async () => {
    const stale = join(storage, '.incoming', 'stale.upload');
    const fresh = join(storage, '.incoming', 'fresh.upload');
    const previewDir = join(storage, 'essay-requirements-preview');
    await mkdir(previewDir, { recursive: true });
    const oldPreview = join(previewDir, 'old.png');
    await Promise.all(
      [stale, fresh, oldPreview].map((path) => writeFile(path, png)),
    );
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await Promise.all(
      [stale, oldPreview].map((path) => utimes(path, yesterday, yesterday)),
    );
    const originals = await readdir(join(storage, 'objective-grading'));
    await app.get(ToolUploadService).cleanStaleFiles();
    expect(await readdir(join(storage, '.incoming'))).toEqual(['fresh.upload']);
    expect(await readdir(previewDir)).toEqual([]);
    expect(await readdir(join(storage, 'objective-grading'))).toEqual(
      originals,
    );
    await rm(fresh);
  });
});
