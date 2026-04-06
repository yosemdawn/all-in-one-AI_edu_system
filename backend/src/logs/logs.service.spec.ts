import { LogsService } from './logs.service';

describe('LogsService', () => {
  type LogsServiceDependencies = ConstructorParameters<typeof LogsService>;
  type SanitizedLogPayload = {
    password: string;
    profile: {
      refreshToken: string;
      nested: {
        Authorization: string;
        safe: string;
      };
    };
    items: Array<{
      apiKey: string;
    }>;
  };

  const createService = () => {
    const model = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    const appService = {
      envelope: jest.fn((data: unknown, message: string) => ({
        code: 200,
        message,
        data,
      })),
    };

    return {
      service: new LogsService(
        model as unknown as LogsServiceDependencies[0],
        appService as unknown as LogsServiceDependencies[1],
      ),
      model,
      appService,
    };
  };

  it('redacts sensitive fields recursively', () => {
    const { service } = createService();

    const result = service.sanitize({
      password: '123456',
      profile: {
        refreshToken: 'token-value',
        nested: {
          Authorization: 'Bearer abc',
          safe: 'ok',
        },
      },
      items: [{ apiKey: 'secret' }],
    }) as SanitizedLogPayload;

    expect(result.password).toBe('[REDACTED]');
    expect(result.profile.refreshToken).toBe('[REDACTED]');
    expect(result.profile.nested.Authorization).toBe('[REDACTED]');
    expect(result.profile.nested.safe).toBe('ok');
    expect(result.items[0].apiKey).toBe('[REDACTED]');
  });

  it('supports alias sorting parameters when querying logs', async () => {
    const { service, model, appService } = createService();
    const lean = jest.fn().mockResolvedValue([
      {
        _id: 'log-1',
        endpoint: '/api/v1/auth/login',
        method: 'POST',
        ip: '127.0.0.1',
        statusCode: 201,
        timestamp: new Date('2026-04-03T12:00:00.000Z'),
        responseTime: 30,
      },
    ]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });

    model.find.mockImplementation(find);
    model.countDocuments.mockResolvedValue(1);

    const result = await service.getLogs({
      page: 1,
      limit: 20,
      sort: 'statusCode',
      order: 'asc',
    });

    expect(find).toHaveBeenCalledWith({});
    expect(sort).toHaveBeenCalledWith({ statusCode: 1, _id: -1 });
    expect(appService.envelope).toHaveBeenCalled();
    expect(result.data.total).toBe(1);
    expect(result.data.items[0].id).toBe('log-1');
  });
});
