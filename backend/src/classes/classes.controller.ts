import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddStudentsDto } from './dto/add-students.dto';
import { ClassListQueryDto } from './dto/class-list-query.dto';
import { ClassStudentsQueryDto } from './dto/class-students-query.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { ClassesService } from './classes.service';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get('list')
  getClasses(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ClassListQueryDto,
  ) {
    return this.classesService.getClasses(currentUser, query);
  }

  @Get(':id')
  getClass(@Param('id') id: string) {
    return this.classesService.getClass(id);
  }

  @Roles('teacher', 'superadmin')
  @Post('create')
  createClass(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateClassDto,
  ) {
    return this.classesService.createClass(currentUser, body);
  }

  @Roles('teacher', 'superadmin')
  @Post(':id/edit')
  editClass(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateClassDto,
  ) {
    return this.classesService.updateClass(currentUser, id, body);
  }

  @Roles('teacher', 'superadmin')
  @Post(':id/close')
  closeClass(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.classesService.closeClass(currentUser, id);
  }

  @Roles('teacher', 'superadmin')
  @Post(':id/regenerate-code')
  regenerateCode(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.classesService.regenerateCode(currentUser, id);
  }

  @Roles('teacher', 'superadmin')
  @Get(':id/students')
  getClassStudents(@Param('id') id: string, @Query() query: ClassStudentsQueryDto) {
    return this.classesService.getClassStudents(id, query);
  }

  @Roles('teacher', 'superadmin')
  @Post(':id/students')
  addStudents(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AddStudentsDto,
  ) {
    return this.classesService.addStudents(currentUser, id, body);
  }

  @Roles('student')
  @Post('join')
  joinClass(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: JoinClassDto,
  ) {
    return this.classesService.joinClass(currentUser, body);
  }

  @Roles('teacher', 'superadmin')
  @Post(':id/students/status')
  updateStudentStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateStudentStatusDto,
  ) {
    return this.classesService.updateStudentStatus(currentUser, id, body);
  }

  @Roles('student')
  @Post(':id/leave')
  leaveClass(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.classesService.leaveClass(currentUser, id);
  }
}
