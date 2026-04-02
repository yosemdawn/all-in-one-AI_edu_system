import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AssignmentQueryDto } from './assignments/dto/assignment-query.dto';
import { CreateAssignmentDto } from './assignments/dto/create-assignment.dto';
import { UpdateAssignmentStatusDto } from './assignments/dto/update-assignment-status.dto';
import { UpdateAssignmentDto } from './assignments/dto/update-assignment.dto';
import { AssignmentsService } from './assignments/assignments.service';
import { AuthService } from './auth/auth.service';
import { ChangePasswordDto } from './auth/dto/change-password.dto';
import { LoginDto } from './auth/dto/login.dto';
import { RefreshTokenDto } from './auth/dto/refresh-token.dto';
import { RegisterDto } from './auth/dto/register.dto';
import { AddStudentsDto } from './classes/dto/add-students.dto';
import { ClassListQueryDto } from './classes/dto/class-list-query.dto';
import { ClassStudentsQueryDto } from './classes/dto/class-students-query.dto';
import { CreateClassDto } from './classes/dto/create-class.dto';
import { JoinClassDto } from './classes/dto/join-class.dto';
import { UpdateClassDto } from './classes/dto/update-class.dto';
import { UpdateStudentStatusDto } from './classes/dto/update-student-status.dto';
import { ClassesService } from './classes/classes.service';
import { AppService } from './app.service';
import { AdminService } from './admin/admin.service';
import { UsersService } from './users/users.service';
import { DeleteSubmissionDto } from './submissions/dto/delete-submission.dto';
import { SubmissionQueryDto } from './submissions/dto/submission-query.dto';
import { SubmitAssignmentDto } from './submissions/dto/submit-assignment.dto';
import { TeacherReviewDto } from './submissions/dto/teacher-review.dto';
import { SubmissionsService } from './submissions/submissions.service';
import { DashboardService } from './dashboard/dashboard.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly classesService: ClassesService,
    private readonly assignmentsService: AssignmentsService,
    private readonly submissionsService: SubmissionsService,
    private readonly dashboardService: DashboardService,
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Post('v1/auth/login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('auth/login')
  loginCompat(@Body() body: any) {
    return this.authService.login({
      usernameOrEmailOrStudentId:
        body.usernameOrEmailOrStudentId || body.email || body.username,
      password: body.password,
      rememberMe: body.rememberMe,
    });
  }

  @Post('v1/auth/logout')
  logout(@Headers('authorization') authorization?: string) {
    return this.authService.logout(authorization);
  }

  @Post('v1/auth/refresh-token')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body);
  }

  @Get('v1/auth/profile')
  profile(@Headers('authorization') authorization?: string) {
    return this.authService.profile(authorization);
  }

  @Put('v1/auth/password')
  changePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(authorization, body);
  }

  @Put('v1/auth/first-password-change')
  firstChangePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.firstChangePassword(authorization, body);
  }

  @Post('v1/auth/forgot-password')
  forgotPassword() {
    return this.authService.forgotPassword();
  }

  @Post('v1/auth/reset-password')
  resetPassword() {
    return this.authService.resetPassword();
  }

  @Post('v1/auth/register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('auth/register')
  registerCompat(@Body() body: any) {
    return this.authService.register({
      username: body.username || body.email || body.name,
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword || body.password,
      name: body.name,
      classId: body.classId,
    });
  }

  @Get('permissions/user-roles/users/:userId/resources')
  async getResources(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.authService.profile(authorization).then((profile) => {
      const role = profile.data.user.role;
      const roles = [
        {
          _id: `${role}-role`,
          id: `${role}-role`,
          name: role,
          code: role,
        },
      ];
      const permissions =
        role === 'teacher'
          ? ['class:view', 'assignment:create', 'submission:review']
          : role === 'student'
            ? ['assignment:view', 'submission:create']
            : ['system:manage'];
      const menus = this.appService.getMenusByRole(role as any);
      return this.appService.envelope({ roles, permissions, menus }, '获取成功');
    });
  }

  @Get('permissions/user-roles/users/:userId/roles')
  async getUserRoles(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const resources = await this.getResources(_userId, authorization);
    return this.appService.envelope(resources.data.roles, '获取成功');
  }

  @Get('permissions/user-roles/users/:userId/permissions')
  async getUserPermissions(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const resources = await this.getResources(_userId, authorization);
    return this.appService.envelope(resources.data.permissions, '获取成功');
  }

  @Get('permissions/user-roles/users/:userId/menus')
  async getUserMenus(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const resources = await this.getResources(_userId, authorization);
    return this.appService.envelope(resources.data.menus, '获取成功');
  }

  @Put('permissions/user-roles/users/:userId/roles')
  async assignRoles(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(true, '分配成功');
  }

  @Get('permissions/roles')
  async getRoleList(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getRoleList();
  }

  @Get('permissions/roles/:id')
  async getRoleById(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    const roles = this.appService.getRoleList().data.items;
    return this.appService.envelope(roles.find((r: any) => r._id === id), '获取成功');
  }

  @Get('permissions/roles/:id/with-menus')
  async getRoleWithMenus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    const roles = this.appService.getRoleList().data.items;
    return this.appService.envelope(
      { ...roles.find((r: any) => r._id === id), menus: [] },
      '获取成功',
    );
  }

  @Post('permissions/roles')
  async createRole(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: `r-${Date.now()}`, ...body }, '创建成功');
  }

  @Put('permissions/roles/:id')
  async updateRole(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: id, ...body }, '更新成功');
  }

  @Delete('permissions/roles/:id')
  async deleteRole(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ success: true, id }, '删除成功');
  }

  @Put('permissions/roles/:id/menus')
  async assignMenus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: id, menuIds: body.menuIds }, '分配成功');
  }

  @Get('permissions/menus')
  async getMenuList(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getMenuList();
  }

  @Get('permissions/menus/:id')
  async getMenuById(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    const menus = this.appService.getMenuList().data;
    return this.appService.envelope(menus.find((m: any) => m._id === id), '获取成功');
  }

  @Post('permissions/menus')
  async createMenu(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: `m-${Date.now()}`, ...body }, '创建成功');
  }

  @Put('permissions/menus/:id')
  async updateMenu(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: id, ...body }, '更新成功');
  }

  @Delete('permissions/menus/:id')
  async deleteMenu(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ success: true, id }, '删除成功');
  }

  @Get('users')
  async getUsers(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.getUsers(query), '获取成功');
  }

  @Post('users')
  async createUser(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.createUser(body), '创建成功');
  }

  @Get('users/profile')
  async getUserProfile(@Headers('authorization') authorization?: string) {
    return this.appService.envelope(
      await this.usersService.getCurrentUserProfile(authorization),
      '获取成功',
    );
  }

  @Put('users/profile')
  async updateUserProfile(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.envelope(
      await this.usersService.updateCurrentUserProfile(authorization, body),
      '更新成功',
    );
  }

  @Put('users/password')
  async updatePassword(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.envelope(
      await this.usersService.updateCurrentUserPassword(authorization, body),
      '修改成功',
    );
  }

  @Get('users/:id')
  async getUser(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.getUser(id), '获取成功');
  }

  @Patch('users/:id')
  async patchUser(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.updateUser(id, body), '更新成功');
  }

  @Patch('users/:id/password')
  async patchUserPassword(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.updateUserPassword(id, body), '修改成功');
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.resetUserPassword(id, body), '重置成功');
  }

  @Delete('users/:id')
  async deleteUser(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.deleteUser(id), '删除成功');
  }

  @Post('users/batch-import')
  async importUsers(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.importUsers(body), '导入成功');
  }

  @Post('users/batch-delete')
  async deleteUsers(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(await this.usersService.deleteUsers(body), '删除成功');
  }

  @Get('classes/list')
  getClasses(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ClassListQueryDto,
  ) {
    return this.classesService.getClasses(authorization, query);
  }

  @Get('classes/:id')
  getClass(@Param('id') id: string) {
    return this.classesService.getClass(id);
  }

  @Post('classes/create')
  createClass(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateClassDto,
  ) {
    return this.classesService.createClass(authorization, body);
  }

  @Post('classes/:id/edit')
  editClass(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateClassDto,
  ) {
    return this.classesService.updateClass(authorization, id, body);
  }

  @Post('classes/:id/close')
  closeClass(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.classesService.closeClass(authorization, id);
  }

  @Post('classes/:id/regenerate-code')
  regenerateCode(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.classesService.regenerateCode(authorization, id);
  }

  @Get('classes/:id/students')
  getClassStudents(@Param('id') id: string, @Query() query: ClassStudentsQueryDto) {
    return this.classesService.getClassStudents(id, query);
  }

  @Post('classes/:id/students')
  addStudents(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: AddStudentsDto,
  ) {
    return this.classesService.addStudents(authorization, id, body);
  }

  @Post('classes/join')
  joinClass(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: JoinClassDto,
  ) {
    return this.classesService.joinClass(authorization, body);
  }

  @Post('classes/:id/students/status')
  updateStudentStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateStudentStatusDto,
  ) {
    return this.classesService.updateStudentStatus(authorization, id, body);
  }

  @Post('classes/:id/leave')
  leaveClass(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.classesService.leaveClass(authorization, id);
  }

  @Get('teacher/assignments')
  getTeacherAssignments(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.listAssignments(authorization, query);
  }

  @Get('teacher/assignments/:id')
  getTeacherAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.getAssignment(authorization, id);
  }

  @Get('teacher/assignments/:id/students')
  getTeacherAssignmentStudents(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.assignmentsService.getAssignmentStudents(authorization, id, query);
  }

  @Post('teacher/assignments')
  createTeacherAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateAssignmentDto,
  ) {
    return this.assignmentsService.createAssignment(authorization, body);
  }

  @Post('teacher/assignments/:id/update')
  updateTeacherAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.updateAssignment(authorization, id, body);
  }

  @Post('teacher/assignments/:id/status')
  updateTeacherAssignmentStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateAssignmentStatusDto,
  ) {
    return this.assignmentsService.updateAssignmentStatus(authorization, id, body);
  }

  @Post('teacher/assignments/:id/delete')
  deleteTeacherAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.deleteAssignment(authorization, id);
  }

  @Get('student/assignments')
  getStudentAssignments(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.getStudentAssignments(authorization, query);
  }

  @Get('student/assignments/statistics')
  getStudentAssignmentStatistics(@Headers('authorization') authorization: string | undefined) {
    return this.assignmentsService.getStudentAssignmentStatistics(authorization);
  }

  @Get('student/assignments/:assignmentId')
  getStudentAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('assignmentId') assignmentId: string,
    @Query('classId') classId?: string,
  ) {
    return this.assignmentsService.getStudentAssignment(authorization, assignmentId, classId);
  }

  @Post('students/submissions/submit')
  submit(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SubmitAssignmentDto,
  ) {
    return this.submissionsService.submit(authorization, body);
  }

  @Get('students/submissions/my/:assignmentId')
  getMySubmission(
    @Headers('authorization') authorization: string | undefined,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.submissionsService.getMySubmission(authorization, assignmentId);
  }

  @Post('students/submissions/delete')
  deleteSubmission(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: DeleteSubmissionDto,
  ) {
    return this.submissionsService.deleteSubmission(authorization, body);
  }

  @Get('teachers/submissions/list')
  getSubmissionList(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: SubmissionQueryDto,
  ) {
    return this.submissionsService.getSubmissionList(authorization, query);
  }

  @Get('teachers/submissions/detail/:submissionId')
  getSubmissionDetail(
    @Headers('authorization') authorization: string | undefined,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissionsService.getSubmissionDetail(authorization, submissionId);
  }

  @Post('teachers/submissions/review')
  teacherReview(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: TeacherReviewDto,
  ) {
    return this.submissionsService.teacherReview(authorization, body);
  }

  @Get('v1/ai-rules')
  async getAiRuleList(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: any,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.getAiRuleList(query);
  }

  @Get('v1/ai-rules/available/list')
  async getAvailableAiRules(
    @Headers('authorization') authorization: string | undefined,
    @Query('status') status?: string,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.getAvailableAiRules(status || 'active');
  }

  @Get('v1/ai-rules/:id')
  async getAiRule(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.getAiRule(id);
  }

  @Post('v1/ai-rules')
  async createAiRule(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.createAiRule(body);
  }

  @Post('v1/ai-rules/:id/update')
  async updateAiRule(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.updateAiRule(id, body);
  }

  @Post('v1/ai-rules/:id/delete')
  async deleteAiRule(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.deleteAiRule(id);
  }

  @Post('v1/ai-rules/:id/copy')
  async copyAiRule(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['teacher', 'superadmin']);
    return this.appService.copyAiRule(id, body);
  }

  @Get('admin/ai-models')
  async getAiModels(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getAiModels();
  }

  @Get('admin/ai-models/active')
  async getActiveAiModels(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(this.appService.getAiModels().data.models.filter((m: any) => m.status === 'active'), '获取成功');
  }

  @Get('admin/ai-models/:code')
  async getAiModel(
    @Headers('authorization') authorization: string | undefined,
    @Param('code') code: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getAiModel(code);
  }

  @Put('admin/ai-models/:code')
  async updateAiModel(
    @Headers('authorization') authorization: string | undefined,
    @Param('code') code: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.updateAiModel(code, body);
  }

  @Post('admin/ai-models/:code/default')
  async setDefaultModel(
    @Headers('authorization') authorization: string | undefined,
    @Param('code') code: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.setDefaultModel(code);
  }

  @Get('admin/ai-models/:code/balance')
  async getModelBalance(
    @Headers('authorization') authorization: string | undefined,
    @Param('code') code: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getModelBalance(code);
  }

  @Post('admin/ai-models/:code/test')
  async testModel(
    @Headers('authorization') authorization: string | undefined,
    @Param('code') code: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.testModel(code);
  }

  @Get('admin/ai-models/:code/stats')
  async getModelStats(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getModelStats();
  }

  @Post('admin/ai-models/initialize')
  async initializeModels(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.initializeModels();
  }

  @Get('admin/dashboard/overview')
  async getAdminOverview(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.adminService.getOverview();
    return this.appService.getAdminOverview();
  }

  @Get('admin/dashboard/ai-models')
  async getAdminAiModels(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getAiModels();
  }

  @Get('admin/dashboard/recent-users')
  async getRecentUsers(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.adminService.getRecentUsers();
    return this.appService.envelope(
      {
        users: [
          {
            id: 'u-student',
            name: '张同学',
            role: 'student',
            email: 'student@nengdou.local',
            createdAt: new Date().toISOString(),
            status: 'active',
          },
        ],
      },
      '获取成功',
    );
  }

  @Get('admin/dashboard/health')
  async getHealth(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.adminService.getHealth();
    return this.appService.envelope(
      {
        db: 'ok',
        redis: 'ok',
        ai: 'ok',
      },
      '获取成功',
    );
  }

  @Get('teacher/dashboard/stats')
  async getTeacherDashboard(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['teacher', 'superadmin']);
    return this.dashboardService.getTeacherDashboard(profile.data.user.id);
  }

  @Get('teacher/dashboard/pending-tasks')
  async getTeacherPendingTasks(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['teacher', 'superadmin']);
    return this.dashboardService.getTeacherPendingTasks(profile.data.user.id);
  }

  @Get('teacher/dashboard/performance-summary')
  async getTeacherPerformanceSummary(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['teacher', 'superadmin']);
    return this.dashboardService.getTeacherPerformanceSummary(profile.data.user.id);
  }

  @Get('teacher/dashboard/quick-actions')
  async getTeacherQuickActions(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['teacher', 'superadmin']);
    return this.dashboardService.getTeacherQuickActions(profile.data.user.id);
  }

  @Get('student/dashboard/stats')
  async getStudentDashboard(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['student']);
    return this.dashboardService.getStudentDashboard(profile.data.user.id);
  }

  @Get('student/dashboard/learning-progress')
  async getStudentLearningProgress(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['student']);
    return this.dashboardService.getStudentLearningProgress(profile.data.user.id);
  }

  @Get('student/dashboard/achievements')
  async getStudentAchievements(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['student']);
    return this.dashboardService.getStudentAchievements(profile.data.user.id);
  }

  @Get('student/dashboard/study-recommendations')
  async getStudentRecommendations(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, ['student']);
    return this.dashboardService.getStudentStudyRecommendations(profile.data.user.id);
  }

  @Get('logs')
  async getLogs(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getLogs();
  }

  @Get('v1/templates/:type')
  getTemplate(@Param('type') type: string) {
    return this.appService.envelope({ type, url: `/templates/${type}.xlsx` }, '获取成功');
  }
  private async requireRole(
    authorization: string | undefined,
    allowedRoles: Array<'superadmin' | 'teacher' | 'student'>,
  ) {
    const profile = await this.authService.profile(authorization);
    this.assertDashboardRole(profile.data.user.role, allowedRoles);
    return profile.data.user;
  }

  private assertDashboardRole(
    role: string,
    allowedRoles: Array<'superadmin' | 'teacher' | 'student'>,
  ) {
    if (!allowedRoles.includes(role as 'superadmin' | 'teacher' | 'student')) {
      throw new ForbiddenException('当前用户无权访问该看板');
    }
  }
}
