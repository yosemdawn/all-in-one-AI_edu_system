import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ToolUploadInterceptor } from './tool-upload.interceptor';
import type { ToolUploadedFile } from './tool-upload.service';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ParseTextDto } from './dto/parse-text.dto';
import { ToolTaskQueryDto } from './dto/tool-task-query.dto';
import { TeacherToolsService } from './teacher-tools.service';

type UploadedFileMap = {
  answerCards?: ToolUploadedFile[];
  requirementImages?: ToolUploadedFile[];
  essayImages?: ToolUploadedFile[];
};

@Controller('teacher/tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'superadmin')
export class TeacherToolsController {
  constructor(private readonly teacherToolsService: TeacherToolsService) {}

  @Get('tasks')
  listTasks(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ToolTaskQueryDto,
  ) {
    return this.teacherToolsService.listTasks(currentUser, query);
  }

  @Get('tasks/:id')
  getTask(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.teacherToolsService.getTask(currentUser, id);
  }

  @Post('tasks/:id/cancel')
  cancelTask(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.teacherToolsService.cancelTask(currentUser, id);
  }

  @Get('tasks/:id/export')
  async exportTask(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const result = await this.teacherToolsService.exportTask(currentUser, id);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    response.send(result.content);
  }

  @Post('objective-grading/parse-answers')
  parseAnswers(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ParseTextDto,
  ) {
    return this.teacherToolsService.parseStandardAnswers(
      currentUser,
      body.text,
    );
  }

  @Post('objective-grading/parse-score-config')
  parseScoreConfig(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ParseTextDto,
  ) {
    return this.teacherToolsService.parseScoreConfig(currentUser, body.text);
  }

  @Post('objective-grading/tasks')
  @UseInterceptors(
    ToolUploadInterceptor([{ name: 'answerCards', maxCount: 100 }]),
  )
  createObjectiveTask(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadedFileMap,
  ) {
    return this.teacherToolsService.createObjectiveTask(
      currentUser,
      body,
      files.answerCards || [],
    );
  }

  @Post('essay-batch/preview-requirements')
  @UseInterceptors(
    ToolUploadInterceptor([{ name: 'requirementImages', maxCount: 5 }]),
  )
  previewEssayRequirements(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadedFileMap,
  ) {
    return this.teacherToolsService.previewEssayRequirements(
      currentUser,
      body,
      files.requirementImages || [],
    );
  }

  @Post('essay-batch/tasks')
  @UseInterceptors(
    ToolUploadInterceptor([
      { name: 'requirementImages', maxCount: 5 },
      { name: 'essayImages', maxCount: 100 },
    ]),
  )
  createEssayTask(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadedFileMap,
  ) {
    return this.teacherToolsService.createEssayTask(currentUser, body, {
      requirementImages: files.requirementImages || [],
      essayImages: files.essayImages || [],
    });
  }
}
