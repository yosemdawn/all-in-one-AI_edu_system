import { SkipThrottle } from '@nestjs/throttler';
import { ReadinessService } from './readiness.service';
import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly readiness: ReadinessService,
  ) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @SkipThrottle({ default: true, auth: true })
  @Get('healthz')
  healthz() {
    return this.appService.getHealth();
  }

  @SkipThrottle({ default: true, auth: true })
  @Get('readyz')
  readyz() {
    return this.readiness.check();
  }

  @Get('v1/templates/:type')
  getTemplate(@Param('type') type: string) {
    return this.appService.envelope(
      { type, url: `/templates/${type}.xlsx` },
      'success',
    );
  }
}
