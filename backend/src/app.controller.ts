import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Get('v1/templates/:type')
  getTemplate(@Param('type') type: string) {
    return this.appService.envelope({ type, url: `/templates/${type}.xlsx` }, 'success');
  }
}
