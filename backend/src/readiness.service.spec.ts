import { ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';
import { ReadinessService } from './readiness.service';

describe('Dependency readiness', () => {
  const create = (mongo: unknown, settings: Record<string, string> = {}) =>
    new ReadinessService(mongo as Connection, new ConfigService(settings));
  it('reports an optional disabled queue without hiding Mongo failure', async () => {
    const service = create({
      readyState: 1,
      db: { command: () => Promise.resolve({ ok: 1 }) },
    });
    expect((await service.check()).data.dependencies).toEqual({
      mongo: 'up',
      redis: 'disabled',
    });
    await expect(create({ readyState: 0 }).check()).rejects.toMatchObject({
      status: 503,
    });
  });
  it('fails readiness when the required queue is missing', async () => {
    const service = create(
      { readyState: 1, db: { command: () => Promise.resolve({ ok: 1 }) } },
      { NODE_ENV: 'production' },
    );
    await expect(service.check()).rejects.toMatchObject({ status: 503 });
  });
  it('bounds a hung Mongo ping and cleans up its timeout', async () => {
    jest.useFakeTimers();
    try {
      const service = create({
        readyState: 1,
        db: { command: () => new Promise(() => undefined) },
      });
      const result = expect(service.check()).rejects.toMatchObject({
        status: 503,
      });
      await jest.advanceTimersByTimeAsync(1501);
      await result;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
