import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  envelope<T>(data: T, message = 'success') {
    return { code: 200, message, data };
  }

  getHello() {
    return this.envelope(
      { name: 'yosem-backend', ok: true },
      'backend ready',
    );
  }

  getHealth() {
    return this.envelope(
      {
        ok: true,
        service: 'yosem-backend',
        timestamp: new Date().toISOString(),
      },
      'healthy',
    );
  }
}
