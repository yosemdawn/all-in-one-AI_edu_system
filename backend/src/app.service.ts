import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  envelope<T>(data: T, message = 'success') {
    return { code: 200, message, data };
  }

  getHello() {
    return this.envelope({ name: 'nengdou-backend', ok: true }, 'backend ready');
  }
}
