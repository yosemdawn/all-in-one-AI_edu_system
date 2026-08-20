import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DeleteSubmissionDto } from './dto/delete-submission.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { TeacherReviewDto } from './dto/teacher-review.dto';
import {
  MAX_SUBMISSION_FILES,
  MAX_SUBMISSION_FILE_SIZE,
} from './submission-files.constants';
import { SubmissionsService } from './submissions.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Roles('student')
  @Post('students/submissions/submit')
  @UseInterceptors(
    FilesInterceptor('files', MAX_SUBMISSION_FILES, {
      limits: {
        files: MAX_SUBMISSION_FILES,
        fileSize: MAX_SUBMISSION_FILE_SIZE,
      },
    }),
  )
  submit(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: SubmitAssignmentDto,
    @UploadedFiles() files: Array<{
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    }> = [],
  ) {
    return this.submissionsService.submit(currentUser, body, files);
  }

  @Get('students/submissions/:submissionId/attachments/:attachmentId')
  async downloadAttachment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('submissionId') submissionId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.submissionsService.getAttachmentFile(
      currentUser,
      submissionId,
      attachmentId,
    );

    return new StreamableFile(createReadStream(attachment.path), {
      type: attachment.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      length: attachment.size,
    });
  }

  @Roles('student')
  @Get('students/submissions/my/:assignmentId')
  getMySubmission(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.submissionsService.getMySubmission(currentUser, assignmentId);
  }

  @Roles('student', 'superadmin')
  @Post('students/submissions/delete')
  deleteSubmission(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: DeleteSubmissionDto,
  ) {
    return this.submissionsService.deleteSubmission(currentUser, body);
  }

  @Roles('teacher', 'superadmin')
  @Get('teachers/submissions/list')
  getSubmissionList(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: SubmissionQueryDto,
  ) {
    return this.submissionsService.getSubmissionList(currentUser, query);
  }

  @Roles('teacher', 'superadmin')
  @Get('teachers/submissions/detail/:submissionId')
  getSubmissionDetail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissionsService.getSubmissionDetail(
      currentUser,
      submissionId,
    );
  }

  @Roles('teacher', 'superadmin')
  @Post('teachers/submissions/review')
  teacherReview(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: TeacherReviewDto,
  ) {
    return this.submissionsService.teacherReview(currentUser, body);
  }
}
