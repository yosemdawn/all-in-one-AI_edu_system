import { AdminService } from './admin.service';

describe('AdminService', () => {
  const createCountModel = (count: number) =>
    ({
      countDocuments: jest.fn().mockResolvedValue(count),
      aggregate: jest.fn(),
      find: jest.fn(),
      db: {
        readyState: 1,
        name: 'nengdou_ai_test',
        db: { admin: () => ({ ping: jest.fn() }) },
      },
    }) as any;

  it('builds overview aggregates and percentages', async () => {
    const userModel = createCountModel(10);
    const classModel = createCountModel(4);
    const assignmentModel = createCountModel(3);
    const submissionModel = createCountModel(8);

    userModel.aggregate.mockResolvedValue([
      { _id: 'superadmin', count: 1 },
      { _id: 'teacher', count: 3 },
      { _id: 'student', count: 6 },
    ]);
    classModel.aggregate.mockResolvedValue([{ _id: 'active', count: 4 }]);
    submissionModel.aggregate.mockResolvedValue([
      { _id: 'submitted', count: 2 },
      { _id: 'teacher_reviewed', count: 6 },
    ]);

    const aiModelsService = {
      getSummary: jest.fn().mockResolvedValue({ totalModels: 2 }),
    };
    const appService = {
      envelope: jest.fn((data, message) => ({ code: 200, message, data })),
    };

    const service = new AdminService(
      userModel,
      classModel,
      assignmentModel,
      submissionModel,
      aiModelsService as any,
      appService as any,
    );

    const result = await service.getOverview();

    expect(result.data.totalUsers).toBe(10);
    expect(result.data.aiModelCount).toBe(2);
    expect(result.data.userRoleDistribution).toEqual([
      { role: 'SUPER_ADMIN', count: 1, percentage: 10 },
      { role: 'TEACHER', count: 3, percentage: 30 },
      { role: 'STUDENT', count: 6, percentage: 60 },
    ]);
    expect(result.data.classStatusDistribution).toEqual([
      { status: 'active', count: 4, percentage: 100 },
    ]);
  });
});
