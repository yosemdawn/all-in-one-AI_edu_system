import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateAiModelDto } from './dto/update-ai-model.dto';
import { AiModelsService } from './ai-models.service';

@Controller('admin/ai-models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class AiModelsController {
  constructor(private readonly aiModelsService: AiModelsService) {}

  @Get()
  getAiModels() {
    return this.aiModelsService.getList();
  }

  @Get('active')
  @Roles('teacher', 'superadmin')
  getActiveAiModels() {
    return this.aiModelsService.getActiveModels();
  }

  @Get(':code')
  getAiModel(@Param('code') code: string) {
    return this.aiModelsService.getModel(code);
  }

  @Put(':code')
  updateAiModel(@Param('code') code: string, @Body() body: UpdateAiModelDto) {
    return this.aiModelsService.updateModel(code, body);
  }

  @Post(':code/default')
  setDefaultModel(@Param('code') code: string) {
    return this.aiModelsService.setDefaultModel(code);
  }

  @Get(':code/balance')
  getModelBalance(@Param('code') code: string) {
    return this.aiModelsService.getModelBalance(code);
  }

  @Post(':code/test')
  testModel(@Param('code') code: string) {
    return this.aiModelsService.testModel(code);
  }

  @Get(':code/stats')
  getModelStats(@Param('code') code: string) {
    return this.aiModelsService.getModelStats(code);
  }

  @Post('initialize')
  initializeModels() {
    return this.aiModelsService.initializeModels();
  }
}
