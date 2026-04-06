import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LogQueryDto } from './dto/log-query.dto';
import { LogsService } from './logs.service';

@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  getLogs(@Query() query: LogQueryDto) {
    return this.logsService.getLogs(query);
  }
}
