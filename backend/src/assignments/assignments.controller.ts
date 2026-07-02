import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignmentStudentsQueryDto } from './dto/assignment-students-query.dto';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentStatusDto } from './dto/update-assignment-status.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AssignmentsService } from './assignments.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Roles('teacher', 'superadmin')
  @Get('teacher/assignments')
  getTeacherAssignments(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.listAssignments(currentUser, query);
  }

  @Roles('teacher', 'superadmin')
  @Get('teacher/assignments/:id')
  getTeacherAssignment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.getAssignment(currentUser, id);
  }

  @Roles('teacher', 'superadmin')
  @Get('teacher/assignments/:id/students')
  getTeacherAssignmentStudents(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: AssignmentStudentsQueryDto,
  ) {
    return this.assignmentsService.getAssignmentStudents(
      currentUser,
      id,
      query,
    );
  }

  @Roles('teacher', 'superadmin')
  @Get('teacher/assignments/:id/analytics')
  getTeacherAssignmentAnalytics(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.getAssignmentAnalytics(currentUser, id);
  }

  @Roles('teacher', 'superadmin')
  @Post('teacher/assignments')
  createTeacherAssignment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateAssignmentDto,
  ) {
    return this.assignmentsService.createAssignment(currentUser, body);
  }

  @Roles('teacher', 'superadmin')
  @Post('teacher/assignments/:id/update')
  updateTeacherAssignment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.updateAssignment(currentUser, id, body);
  }

  @Roles('teacher', 'superadmin')
  @Post('teacher/assignments/:id/status')
  updateTeacherAssignmentStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAssignmentStatusDto,
  ) {
    return this.assignmentsService.updateAssignmentStatus(
      currentUser,
      id,
      body,
    );
  }

  @Roles('teacher', 'superadmin')
  @Post('teacher/assignments/:id/delete')
  deleteTeacherAssignment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.deleteAssignment(currentUser, id);
  }

  @Roles('student')
  @Get('student/assignments')
  getStudentAssignments(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.getStudentAssignments(currentUser, query);
  }

  @Roles('student')
  @Get('student/assignments/statistics')
  getStudentAssignmentStatistics(
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.assignmentsService.getStudentAssignmentStatistics(currentUser);
  }

  @Roles('student')
  @Get('student/assignments/:assignmentId')
  getStudentAssignment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
    @Query('classId') classId?: string,
  ) {
    return this.assignmentsService.getStudentAssignment(
      currentUser,
      assignmentId,
      classId,
    );
  }
}
