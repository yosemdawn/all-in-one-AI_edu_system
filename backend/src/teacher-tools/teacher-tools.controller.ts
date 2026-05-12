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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  answerCards?: Array<{
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }>;
  requirementImages?: Array<{
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }>;
  essayImages?: Array<{
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }>;
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
    FileFieldsInterceptor([{ name: 'answerCards', maxCount: 100 }], {
      limits: { files: 100, fileSize: 15 * 1024 * 1024 },
    }),
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
    FileFieldsInterceptor([{ name: 'requirementImages', maxCount: 5 }], {
      limits: { files: 5, fileSize: 15 * 1024 * 1024 },
    }),
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
    FileFieldsInterceptor(
      [
        { name: 'requirementImages', maxCount: 5 },
        { name: 'essayImages', maxCount: 100 },
      ],
      {
        limits: { files: 105, fileSize: 15 * 1024 * 1024 },
      },
    ),
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

