import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import Redis from 'ioredis';
import { withTimeout } from './common/with-timeout';

@Injectable()
export class ReadinessService implements OnModuleDestroy {
  private readonly redis?: Redis;
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly config: ConfigService,
  ) {
    const url = config.get<string>('REDIS_URL');
    if (url) {
      this.redis = new Redis(url, {
        connectTimeout: 1500,
        commandTimeout: 1500,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
      });
      this.redis.on('error', () => undefined);
    }
  }

  async check() {
    const required =
      (this.config.get<string>('AI_REVIEW_REQUIRED') !== 'false' &&
        this.config.get<string>('NODE_ENV') === 'production') ||
      this.config.get<string>('AI_REVIEW_REQUIRED') === 'true';
    const [mongo, redis] = await Promise.allSettled([
      withTimeout(
        this.mongo.readyState === ConnectionStates.connected && this.mongo.db
          ? this.mongo.db.command({ ping: 1 }, { timeoutMS: 1000 })
          : Promise.reject(new Error('Disconnected')),
        1500,
      ),
      withTimeout(
        this.redis
          ? this.redis.ping()
          : required
            ? Promise.reject(new Error('Queue not configured'))
            : Promise.resolve('disabled'),
        1500,
      ),
    ]);
    const dependencies = {
      mongo: mongo.status === 'fulfilled' ? 'up' : 'down',
      redis:
        redis.status === 'fulfilled'
          ? this.redis
            ? 'up'
            : 'disabled'
          : 'down',
    };
    if (mongo.status === 'rejected' || redis.status === 'rejected') {
      throw new ServiceUnavailableException({
        message: 'Dependencies unavailable',
        dependencies,
      });
    }
    return { code: 200, message: 'ready', data: { ok: true, dependencies } };
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
