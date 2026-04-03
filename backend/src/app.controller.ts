import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthContextService } from './auth/auth-context.service';
import { UserRole } from './auth/authenticated-user.interface';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Get('permissions/user-roles/users/:userId/resources')
  async getResources(
    @Param('userId') _userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const currentUser = await this.authContextService.authenticate(authorization);
    const role = currentUser.role;
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
    const menus = this.appService.getMenusByRole(role);
    return this.appService.envelope({ roles, permissions, menus }, '鑾峰彇鎴愬姛');
  }

  @Get('permissions/user-roles/users/:userId/roles')
  async getUserRoles(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const resources = await this.getResources(userId, authorization);
    return this.appService.envelope(resources.data.roles, '鑾峰彇鎴愬姛');
  }

  @Get('permissions/user-roles/users/:userId/permissions')
  async getUserPermissions(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const resources = await this.getResources(userId, authorization);
    return this.appService.envelope(resources.data.permissions, '鑾峰彇鎴愬姛');
  }

  @Get('permissions/user-roles/users/:userId/menus')
  async getUserMenus(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const resources = await this.getResources(userId, authorization);
    return this.appService.envelope(resources.data.menus, '鑾峰彇鎴愬姛');
  }

  @Put('permissions/user-roles/users/:userId/roles')
  async assignRoles(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope(true, '鍒嗛厤鎴愬姛');
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
    return this.appService.envelope(roles.find((r: any) => r._id === id), '鑾峰彇鎴愬姛');
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
      '鑾峰彇鎴愬姛',
    );
  }

  @Post('permissions/roles')
  async createRole(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: `r-${Date.now()}`, ...body }, '鍒涘缓鎴愬姛');
  }

  @Put('permissions/roles/:id')
  async updateRole(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: id, ...body }, '鏇存柊鎴愬姛');
  }

  @Delete('permissions/roles/:id')
  async deleteRole(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ success: true, id }, '鍒犻櫎鎴愬姛');
  }

  @Put('permissions/roles/:id/menus')
  async assignMenus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: id, menuIds: body.menuIds }, '鍒嗛厤鎴愬姛');
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
    return this.appService.envelope(menus.find((m: any) => m._id === id), '鑾峰彇鎴愬姛');
  }

  @Post('permissions/menus')
  async createMenu(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: `m-${Date.now()}`, ...body }, '鍒涘缓鎴愬姛');
  }

  @Put('permissions/menus/:id')
  async updateMenu(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ _id: id, ...body }, '鏇存柊鎴愬姛');
  }

  @Delete('permissions/menus/:id')
  async deleteMenu(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.envelope({ success: true, id }, '鍒犻櫎鎴愬姛');
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
    return this.appService.envelope(
      this.appService.getAiModels().data.models.filter((m: any) => m.status === 'active'),
      '鑾峰彇鎴愬姛',
    );
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

  @Get('logs')
  async getLogs(@Headers('authorization') authorization?: string) {
    await this.requireRole(authorization, ['superadmin']);
    return this.appService.getLogs();
  }

  @Get('v1/templates/:type')
  getTemplate(@Param('type') type: string) {
    return this.appService.envelope({ type, url: `/templates/${type}.xlsx` }, '鑾峰彇鎴愬姛');
  }

  private async requireRole(
    authorization: string | undefined,
    allowedRoles: UserRole[],
  ) {
    const currentUser = await this.authContextService.authenticate(authorization);
    this.assertAllowedRole(currentUser.role, allowedRoles);
    return currentUser;
  }

  private assertAllowedRole(role: UserRole, allowedRoles: UserRole[]) {
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException('Forbidden');
    }
  }
}
