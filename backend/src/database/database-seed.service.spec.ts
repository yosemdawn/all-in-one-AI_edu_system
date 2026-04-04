import { DatabaseSeedService } from './database-seed.service';

describe('DatabaseSeedService', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDemoSeed = process.env.ENABLE_DEMO_SEED;

  const createService = () => {
    const connection = {
      dropDatabase: jest.fn().mockResolvedValue(undefined),
    };
    const userModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue([
        {
          id: 'admin-id',
        },
        {
          id: 'teacher-id',
          name: 'Teacher One',
        },
        {
          id: 'student-id',
          name: 'Student One',
          studentId: '20250001',
          save: jest.fn().mockResolvedValue(undefined),
        },
      ]),
    };
    const classModel = {
      create: jest.fn().mockResolvedValue({
        id: 'class-id',
        name: 'Demo Class 1',
      }),
    };
    const membershipModel = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const assignmentModel = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new DatabaseSeedService(
        connection as any,
        userModel as any,
        classModel as any,
        membershipModel as any,
        assignmentModel as any,
      ),
      connection,
      userModel,
      classModel,
      membershipModel,
      assignmentModel,
    };
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_DEMO_SEED;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDemoSeed === undefined) {
      delete process.env.ENABLE_DEMO_SEED;
    } else {
      process.env.ENABLE_DEMO_SEED = originalDemoSeed;
    }
  });

  it('skips seeding in production unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production';
    const { service, connection, userModel, classModel } = createService();

    await service.onApplicationBootstrap();

    expect(connection.dropDatabase).not.toHaveBeenCalled();
    expect(userModel.countDocuments).not.toHaveBeenCalled();
    expect(userModel.create).not.toHaveBeenCalled();
    expect(classModel.create).not.toHaveBeenCalled();
  });

  it('skips seeding when the target database already has users', async () => {
    const { service, userModel, classModel } = createService();
    userModel.countDocuments.mockResolvedValue(2);

    await service.onApplicationBootstrap();

    expect(userModel.countDocuments).toHaveBeenCalled();
    expect(userModel.create).not.toHaveBeenCalled();
    expect(classModel.create).not.toHaveBeenCalled();
  });

  it('drops the test database before seeding test fixtures', async () => {
    process.env.NODE_ENV = 'test';
    const {
      service,
      connection,
      userModel,
      classModel,
      membershipModel,
      assignmentModel,
    } = createService();

    await service.onApplicationBootstrap();

    expect(connection.dropDatabase).toHaveBeenCalled();
    expect(userModel.create).toHaveBeenCalled();
    expect(classModel.create).toHaveBeenCalled();
    expect(membershipModel.create).toHaveBeenCalled();
    expect(assignmentModel.create).toHaveBeenCalled();
  });

  it('allows explicit demo seeding in production when enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_SEED = 'true';
    const { service, userModel, classModel } = createService();

    await service.onApplicationBootstrap();

    expect(userModel.countDocuments).toHaveBeenCalled();
    expect(userModel.create).toHaveBeenCalled();
    expect(classModel.create).toHaveBeenCalled();
  });
});
