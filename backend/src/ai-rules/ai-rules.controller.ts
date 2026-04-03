import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiRuleListQueryDto } from './dto/ai-rule-list-query.dto';
import { CopyAiRuleDto } from './dto/copy-ai-rule.dto';
import { CreateAiRuleDto } from './dto/create-ai-rule.dto';
import { UpdateAiRuleDto } from './dto/update-ai-rule.dto';
import { AiRulesService } from './ai-rules.service';

@Controller('v1/ai-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'superadmin')
export class AiRulesController {
  constructor(private readonly aiRulesService: AiRulesService) {}

  @Get()
  getAiRuleList(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: AiRuleListQueryDto) {
    return this.aiRulesService.getAiRuleList(currentUser, query);
  }

  @Get('available/list')
  getAvailableAiRules(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.aiRulesService.getAvailableAiRules(currentUser, status || 'active');
  }

  @Get(':id')
  getAiRule(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.aiRulesService.getAiRule(currentUser, id);
  }

  @Post()
  createAiRule(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: CreateAiRuleDto) {
    return this.aiRulesService.createAiRule(currentUser, body);
  }

  @Post(':id/update')
  updateAiRule(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAiRuleDto,
  ) {
    return this.aiRulesService.updateAiRule(currentUser, id, body);
  }

  @Post(':id/delete')
  deleteAiRule(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.aiRulesService.deleteAiRule(currentUser, id);
  }

  @Post(':id/copy')
  copyAiRule(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CopyAiRuleDto,
  ) {
    return this.aiRulesService.copyAiRule(currentUser, id, body);
  }
}
