import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Post('v1/auth/login')
  login(@Body() body: any) {
    return this.appService.login(body);
  }

  @Post('auth/login')
  loginCompat(@Body() body: any) {
    return this.appService.login({
      usernameOrEmailOrStudentId: body.usernameOrEmailOrStudentId || body.email || body.username,
      password: body.password,
      rememberMe: body.rememberMe,
    });
  }

  @Post('v1/auth/logout')
  logout() {
    return this.appService.logout();
  }

  @Post('v1/auth/refresh-token')
  refresh(@Body() body: any) {
    return this.appService.refresh(body);
  }

  @Get('v1/auth/profile')
  profile(@Headers('authorization') authorization?: string) {
    return this.appService.profile(authorization);
  }

  @Put('v1/auth/password')
  changePassword() {
    return this.appService.changePassword();
  }

  @Put('v1/auth/first-password-change')
  firstChangePassword() {
    return this.appService.changePassword();
  }

  @Post('v1/auth/forgot-password')
  forgotPassword() {
    return this.appService.envelope({ success: true }, '邮件已发送');
  }

  @Post('v1/auth/reset-password')
  resetPassword() {
    return this.appService.envelope({ success: true }, '重置成功');
  }

  @Post('v1/auth/register')
  register(@Body() body: any) {
    return this.appService.register(body);
  }

  @Post('auth/register')
  registerCompat(@Body() body: any) {
    return this.appService.register({
      username: body.username || body.email || body.name,
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword || body.password,
      name: body.name,
      classId: body.classId,
    });
  }

  @Get('permissions/user-roles/users/:userId/resources')
  getResources(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.appService.getResources(authorization);
  }

  @Get('permissions/user-roles/users/:userId/roles')
  getUserRoles(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const data = this.appService.getResources(authorization).data.roles;
    return this.appService.envelope(data, '获取成功');
  }

  @Get('permissions/user-roles/users/:userId/permissions')
  getUserPermissions(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const data = this.appService.getResources(authorization).data.permissions;
    return this.appService.envelope(data, '获取成功');
  }

  @Get('permissions/user-roles/users/:userId/menus')
  getUserMenus(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const data = this.appService.getResources(authorization).data.menus;
    return this.appService.envelope(data, '获取成功');
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
  getClasses(@Query() query: any) {
    return this.appService.getClasses(query);
  }

  @Get('classes/:id')
  getClass(@Param('id') id: string) {
    return this.appService.getClass(id);
  }

  @Post('classes/create')
  createClass(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.createClass(authorization, body);
  }

  @Post('classes/:id/edit')
  editClass(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateClass(id, body);
  }

  @Post('classes/:id/close')
  closeClass(@Param('id') id: string) {
    return this.appService.closeClass(id);
  }

  @Post('classes/:id/regenerate-code')
  regenerateCode(@Param('id') id: string) {
    return this.appService.regenerateCode(id);
  }

  @Get('classes/:id/students')
  getClassStudents(@Param('id') id: string, @Query() query: any) {
    return this.appService.getClassStudents(id, query);
  }

  @Post('classes/:id/students')
  addStudents(@Param('id') id: string, @Body() body: any) {
    return this.appService.addStudents(id, body);
  }

  @Post('classes/join')
  joinClass(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.joinClass(authorization, body.code);
  }

  @Post('classes/:id/students/status')
  updateStudentStatus(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateStudentStatus(id, body);
  }

  @Post('classes/:id/leave')
  leaveClass(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.appService.leaveClass(authorization, id);
  }

  @Get('teacher/assignments')
  getTeacherAssignments(@Query() query: any) {
    return this.appService.listAssignments(query);
  }

  @Get('teacher/assignments/:id')
  getTeacherAssignment(@Param('id') id: string) {
    return this.appService.getAssignment(id);
  }

  @Get('teacher/assignments/:id/students')
  getTeacherAssignmentStudents(@Param('id') id: string, @Query() query: any) {
    return this.appService.getAssignmentStudents(id, query);
  }

  @Post('teacher/assignments')
  createTeacherAssignment(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.createAssignment(authorization, body);
  }

  @Post('teacher/assignments/:id/update')
  updateTeacherAssignment(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateAssignment(id, body);
  }

  @Post('teacher/assignments/:id/status')
  updateTeacherAssignmentStatus(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateAssignmentStatus(id, body);
  }

  @Post('teacher/assignments/:id/delete')
  deleteTeacherAssignment(@Param('id') id: string) {
    return this.appService.deleteAssignment(id);
  }

  @Get('student/assignments')
  getStudentAssignments(@Headers('authorization') authorization: string | undefined) {
    return this.appService.getStudentAssignments(authorization);
  }

  @Get('student/assignments/statistics')
  getStudentAssignmentStatistics(@Headers('authorization') authorization: string | undefined) {
    return this.appService.getStudentAssignmentStatistics(authorization);
  }

  @Get('student/assignments/:assignmentId')
  getStudentAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('assignmentId') assignmentId: string,
    @Query('classId') classId?: string,
  ) {
    return this.appService.getStudentAssignment(authorization, assignmentId, classId);
  }

  @Post('students/submissions/submit')
  submit(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.submit(authorization, body);
  }

  @Get('students/submissions/my/:assignmentId')
  getMySubmission(
    @Headers('authorization') authorization: string | undefined,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.appService.getMySubmission(authorization, assignmentId);
  }

  @Post('students/submissions/delete')
  deleteSubmission(@Body() body: any) {
    return this.appService.deleteSubmission(body);
  }

  @Get('teachers/submissions/list')
  getSubmissionList(@Headers('authorization') authorization: string | undefined, @Query() query: any) {
    return this.appService.getSubmissionList(authorization, query);
  }

  @Get('teachers/submissions/detail/:submissionId')
  getSubmissionDetail(
    @Headers('authorization') authorization: string | undefined,
    @Param('submissionId') submissionId: string,
  ) {
    return this.appService.getSubmissionDetail(authorization, submissionId);
  }

  @Post('teachers/submissions/review')
  teacherReview(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.appService.teacherReview(authorization, body);
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
  getTeacherDashboard(@Headers('authorization') authorization?: string) {
    return this.appService.getTeacherDashboard(authorization);
  }

  @Get('teacher/dashboard/pending-tasks')
  getTeacherPendingTasks(@Headers('authorization') authorization?: string) {
    return this.appService.getTeacherPendingTasks(authorization);
  }

  @Get('teacher/dashboard/performance-summary')
  getTeacherPerformanceSummary(@Headers('authorization') authorization?: string) {
    return this.appService.getTeacherPerformanceSummary(authorization);
  }

  @Get('teacher/dashboard/quick-actions')
  getTeacherQuickActions(@Headers('authorization') authorization?: string) {
    return this.appService.getTeacherQuickActions(authorization);
  }

  @Get('student/dashboard/stats')
  getStudentDashboard(@Headers('authorization') authorization?: string) {
    return this.appService.getStudentDashboard(authorization);
  }

  @Get('student/dashboard/learning-progress')
  getStudentLearningProgress(@Headers('authorization') authorization?: string) {
    return this.appService.getStudentLearningProgress(authorization);
  }

  @Get('student/dashboard/achievements')
  getStudentAchievements(@Headers('authorization') authorization?: string) {
    return this.appService.getStudentAchievements(authorization);
  }

  @Get('student/dashboard/study-recommendations')
  getStudentRecommendations(@Headers('authorization') authorization?: string) {
    return this.appService.getStudentStudyRecommendations(authorization);
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
