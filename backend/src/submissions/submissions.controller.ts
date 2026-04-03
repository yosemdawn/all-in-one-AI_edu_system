import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DeleteSubmissionDto } from './dto/delete-submission.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { TeacherReviewDto } from './dto/teacher-review.dto';
import { SubmissionsService } from './submissions.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Roles('student')
  @Post('students/submissions/submit')
  submit(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: SubmitAssignmentDto,
  ) {
    return this.submissionsService.submit(currentUser, body);
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
    return this.submissionsService.getSubmissionDetail(currentUser, submissionId);
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
