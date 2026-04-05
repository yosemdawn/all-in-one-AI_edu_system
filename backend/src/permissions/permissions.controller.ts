import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignRoleMenusDto } from './dto/assign-role-menus.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { MenuListQueryDto } from './dto/menu-list-query.dto';
import { RoleListQueryDto } from './dto/role-list-query.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('user-roles/users/:userId/resources')
  getResources(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.permissionsService.getResources(currentUser, userId);
  }

  @Get('user-roles/users/:userId/roles')
  getUserRoles(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.permissionsService.getUserRoles(currentUser, userId);
  }

  @Get('user-roles/users/:userId/permissions')
  getUserPermissions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.permissionsService.getUserPermissions(currentUser, userId);
  }

  @Get('user-roles/users/:userId/menus')
  getUserMenus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.permissionsService.getUserMenus(currentUser, userId);
  }

  @Roles('superadmin')
  @Put('user-roles/users/:userId/roles')
  assignRoles(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: AssignUserRolesDto,
  ) {
    return this.permissionsService.assignRolesToUser(
      userId,
      body?.roleIds || [],
      currentUser,
    );
  }

  @Roles('superadmin')
  @Get('roles')
  getRoleList(@Query() query: RoleListQueryDto) {
    return this.permissionsService.getRoleList(query);
  }

  @Roles('superadmin')
  @Get('roles/:id')
  getRoleById(@Param('id') id: string) {
    return this.permissionsService.getRoleById(id);
  }

  @Roles('superadmin')
  @Get('roles/:id/with-menus')
  getRoleWithMenus(@Param('id') id: string) {
    return this.permissionsService.getRoleWithMenus(id);
  }

  @Roles('superadmin')
  @Post('roles')
  createRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateRoleDto,
  ) {
    return this.permissionsService.createRole(body, currentUser);
  }

  @Roles('superadmin')
  @Put('roles/:id')
  updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.permissionsService.updateRole(id, body);
  }

  @Roles('superadmin')
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.permissionsService.deleteRole(id);
  }

  @Roles('superadmin')
  @Put('roles/:id/menus')
  assignMenus(@Param('id') id: string, @Body() body: AssignRoleMenusDto) {
    return this.permissionsService.assignMenusToRole(id, body?.menuIds || []);
  }

  @Roles('superadmin')
  @Get('menus')
  getMenuList(@Query() query: MenuListQueryDto) {
    return this.permissionsService.getMenuList(query);
  }

  @Roles('superadmin')
  @Get('menus/:id')
  getMenuById(@Param('id') id: string) {
    return this.permissionsService.getMenuById(id);
  }

  @Roles('superadmin')
  @Post('menus')
  createMenu(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateMenuDto,
  ) {
    return this.permissionsService.createMenu(body, currentUser);
  }

  @Roles('superadmin')
  @Put('menus/:id')
  updateMenu(@Param('id') id: string, @Body() body: UpdateMenuDto) {
    return this.permissionsService.updateMenu(id, body);
  }

  @Roles('superadmin')
  @Delete('menus/:id')
  deleteMenu(@Param('id') id: string) {
    return this.permissionsService.deleteMenu(id);
  }
}
