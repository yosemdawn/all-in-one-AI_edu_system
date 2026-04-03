import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiModelsService } from './ai-models.service';

@Controller('v1/ai-models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'superadmin')
export class AiModelsPublicController {
  constructor(private readonly aiModelsService: AiModelsService) {}

  @Get('active')
  getActiveAiModels() {
    return this.aiModelsService.getActiveModels();
  }
}
