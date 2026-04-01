import { Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Body } from '@nestjs/common';
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
import { DeleteSubmissionDto } from './submissions/dto/delete-submission.dto';
import { SubmissionQueryDto } from './submissions/dto/submission-query.dto';
import { SubmitAssignmentDto } from './submissions/dto/submit-assignment.dto';
import { TeacherReviewDto } from './submissions/dto/teacher-review.dto';
import { SubmissionsService } from './submissions/submissions.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly classesService: ClassesService,
    private readonly assignmentsService: AssignmentsService,
    private readonly submissionsService: SubmissionsService,
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
  logout() {
    return this.authService.logout();
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
  assignRoles() {
    return this.appService.envelope(true, '分配成功');
  }

  @Get('permissions/roles')
  getRoleList() {
    return this.appService.getRoleList();
  }

  @Get('permissions/roles/:id')
  getRoleById(@Param('id') id: string) {
    const roles = this.appService.getRoleList().data.items;
    return this.appService.envelope(roles.find((r: any) => r._id === id), '获取成功');
  }

  @Get('permissions/roles/:id/with-menus')
  getRoleWithMenus(@Param('id') id: string) {
    const roles = this.appService.getRoleList().data.items;
    return this.appService.envelope(
      { ...roles.find((r: any) => r._id === id), menus: [] },
      '获取成功',
    );
  }

  @Post('permissions/roles')
  createRole(@Body() body: any) {
    return this.appService.envelope({ _id: `r-${Date.now()}`, ...body }, '创建成功');
  }

  @Put('permissions/roles/:id')
  updateRole(@Param('id') id: string, @Body() body: any) {
    return this.appService.envelope({ _id: id, ...body }, '更新成功');
  }

  @Delete('permissions/roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.appService.envelope({ success: true, id }, '删除成功');
  }

  @Put('permissions/roles/:id/menus')
  assignMenus(@Param('id') id: string, @Body() body: any) {
    return this.appService.envelope({ _id: id, menuIds: body.menuIds }, '分配成功');
  }

  @Get('permissions/menus')
  getMenuList() {
    return this.appService.getMenuList();
  }

  @Get('permissions/menus/:id')
  getMenuById(@Param('id') id: string) {
    const menus = this.appService.getMenuList().data;
    return this.appService.envelope(menus.find((m: any) => m._id === id), '获取成功');
  }

  @Post('permissions/menus')
  createMenu(@Body() body: any) {
    return this.appService.envelope({ _id: `m-${Date.now()}`, ...body }, '创建成功');
  }

  @Put('permissions/menus/:id')
  updateMenu(@Param('id') id: string, @Body() body: any) {
    return this.appService.envelope({ _id: id, ...body }, '更新成功');
  }

  @Delete('permissions/menus/:id')
  deleteMenu(@Param('id') id: string) {
    return this.appService.envelope({ success: true, id }, '删除成功');
  }

  @Get('users')
  getUsers(@Query() query: any) {
    return this.appService.getUsers(query);
  }

  @Post('users')
  createUser(@Body() body: any) {
    return this.appService.envelope({ _id: `u-${Date.now()}`, ...body }, '创建成功');
  }

  @Get('users/profile')
  getUserProfile(@Headers('authorization') authorization?: string) {
    return this.appService.profile(authorization);
  }

  @Put('users/profile')
  updateUserProfile(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.updateProfile(authorization, body);
  }

  @Put('users/password')
  updatePassword(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.updatePassword(authorization, body);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.appService.getUser(id);
  }

  @Patch('users/:id')
  patchUser(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateUser(id, body);
  }

  @Patch('users/:id/password')
  patchUserPassword(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateUserPassword(id, body);
  }

  @Post('users/:id/reset-password')
  resetUserPassword(@Param('id') id: string, @Body() body: any) {
    return this.appService.resetUserPassword(id, body);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.appService.deleteUser(id);
  }

  @Post('users/batch-import')
  importUsers(@Body() body: any) {
    return this.appService.importUsers(body);
  }

  @Post('users/batch-delete')
  deleteUsers(@Body() body: any) {
    return this.appService.deleteUsers(body);
  }

  @Get('classes/list')
  getClasses(@Query() query: ClassListQueryDto) {
    return this.classesService.getClasses(query);
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
  editClass(@Param('id') id: string, @Body() body: UpdateClassDto) {
    return this.classesService.updateClass(id, body);
  }

  @Post('classes/:id/close')
  closeClass(@Param('id') id: string) {
    return this.classesService.closeClass(id);
  }

  @Post('classes/:id/regenerate-code')
  regenerateCode(@Param('id') id: string) {
    return this.classesService.regenerateCode(id);
  }

  @Get('classes/:id/students')
  getClassStudents(@Param('id') id: string, @Query() query: ClassStudentsQueryDto) {
    return this.classesService.getClassStudents(id, query);
  }

  @Post('classes/:id/students')
  addStudents(@Param('id') id: string, @Body() body: AddStudentsDto) {
    return this.classesService.addStudents(id, body);
  }

  @Post('classes/join')
  joinClass(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: JoinClassDto,
  ) {
    return this.classesService.joinClass(authorization, body);
  }

  @Post('classes/:id/students/status')
  updateStudentStatus(@Param('id') id: string, @Body() body: UpdateStudentStatusDto) {
    return this.classesService.updateStudentStatus(id, body);
  }

  @Post('classes/:id/leave')
  leaveClass(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.classesService.leaveClass(authorization, id);
  }

  @Get('teacher/assignments')
  getTeacherAssignments(@Query() query: AssignmentQueryDto) {
    return this.assignmentsService.listAssignments(query);
  }

  @Get('teacher/assignments/:id')
  getTeacherAssignment(@Param('id') id: string) {
    return this.assignmentsService.getAssignment(id);
  }

  @Get('teacher/assignments/:id/students')
  getTeacherAssignmentStudents(@Param('id') id: string, @Query() query: any) {
    return this.assignmentsService.getAssignmentStudents(id, query);
  }

  @Post('teacher/assignments')
  createTeacherAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateAssignmentDto,
  ) {
    return this.assignmentsService.createAssignment(authorization, body);
  }

  @Post('teacher/assignments/:id/update')
  updateTeacherAssignment(@Param('id') id: string, @Body() body: UpdateAssignmentDto) {
    return this.assignmentsService.updateAssignment(id, body);
  }

  @Post('teacher/assignments/:id/status')
  updateTeacherAssignmentStatus(
    @Param('id') id: string,
    @Body() body: UpdateAssignmentStatusDto,
  ) {
    return this.assignmentsService.updateAssignmentStatus(id, body);
  }

  @Post('teacher/assignments/:id/delete')
  deleteTeacherAssignment(@Param('id') id: string) {
    return this.assignmentsService.deleteAssignment(id);
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
  deleteSubmission(@Body() body: DeleteSubmissionDto) {
    return this.submissionsService.deleteSubmission(body);
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
  getAiRuleList(@Query() query: any) {
    return this.appService.getAiRuleList(query);
  }

  @Get('v1/ai-rules/available/list')
  getAvailableAiRules(@Query('status') status?: string) {
    return this.appService.getAvailableAiRules(status || 'active');
  }

  @Get('v1/ai-rules/:id')
  getAiRule(@Param('id') id: string) {
    return this.appService.getAiRule(id);
  }

  @Post('v1/ai-rules')
  createAiRule(@Body() body: any) {
    return this.appService.createAiRule(body);
  }

  @Post('v1/ai-rules/:id/update')
  updateAiRule(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateAiRule(id, body);
  }

  @Post('v1/ai-rules/:id/delete')
  deleteAiRule(@Param('id') id: string) {
    return this.appService.deleteAiRule(id);
  }

  @Post('v1/ai-rules/:id/copy')
  copyAiRule(@Param('id') id: string, @Body() body: any) {
    return this.appService.copyAiRule(id, body);
  }

  @Get('admin/ai-models')
  getAiModels() {
    return this.appService.getAiModels();
  }

  @Get('admin/ai-models/active')
  getActiveAiModels() {
    return this.appService.envelope(this.appService.getAiModels().data.models.filter((m: any) => m.status === 'active'), '获取成功');
  }

  @Get('admin/ai-models/:code')
  getAiModel(@Param('code') code: string) {
    return this.appService.getAiModel(code);
  }

  @Put('admin/ai-models/:code')
  updateAiModel(@Param('code') code: string, @Body() body: any) {
    return this.appService.updateAiModel(code, body);
  }

  @Post('admin/ai-models/:code/default')
  setDefaultModel(@Param('code') code: string) {
    return this.appService.setDefaultModel(code);
  }

  @Get('admin/ai-models/:code/balance')
  getModelBalance(@Param('code') code: string) {
    return this.appService.getModelBalance(code);
  }

  @Post('admin/ai-models/:code/test')
  testModel(@Param('code') code: string) {
    return this.appService.testModel(code);
  }

  @Get('admin/ai-models/:code/stats')
  getModelStats() {
    return this.appService.getModelStats();
  }

  @Post('admin/ai-models/initialize')
  initializeModels() {
    return this.appService.initializeModels();
  }

  @Get('admin/dashboard/overview')
  getAdminOverview() {
    return this.appService.getAdminOverview();
  }

  @Get('admin/dashboard/ai-models')
  getAdminAiModels() {
    return this.appService.getAiModels();
  }

  @Get('admin/dashboard/recent-users')
  getRecentUsers() {
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
  getHealth() {
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
    return this.appService.getTeacherDashboardByUserId(profile.data.user.id);
  }

  @Get('teacher/dashboard/pending-tasks')
  async getTeacherPendingTasks(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getTeacherPendingTasksByUserId(profile.data.user.id);
  }

  @Get('teacher/dashboard/performance-summary')
  async getTeacherPerformanceSummary(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getTeacherPerformanceSummaryByUserId(profile.data.user.id);
  }

  @Get('teacher/dashboard/quick-actions')
  async getTeacherQuickActions(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getTeacherQuickActionsByUserId(profile.data.user.id);
  }

  @Get('student/dashboard/stats')
  async getStudentDashboard(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getStudentDashboardByUserId(profile.data.user.id);
  }

  @Get('student/dashboard/learning-progress')
  async getStudentLearningProgress(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getStudentLearningProgressByUserId(profile.data.user.id);
  }

  @Get('student/dashboard/achievements')
  async getStudentAchievements(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getStudentAchievementsByUserId(profile.data.user.id);
  }

  @Get('student/dashboard/study-recommendations')
  async getStudentRecommendations(@Headers('authorization') authorization?: string) {
    const profile = await this.authService.profile(authorization);
    return this.appService.getStudentStudyRecommendationsByUserId(profile.data.user.id);
  }

  @Get('logs')
  getLogs() {
    return this.appService.getLogs();
  }

  @Get('v1/templates/:type')
  getTemplate(@Param('type') type: string) {
    return this.appService.envelope({ type, url: `/templates/${type}.xlsx` }, '获取成功');
  }
}
