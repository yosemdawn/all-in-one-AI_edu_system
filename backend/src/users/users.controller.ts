import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AppService } from '../app.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly appService: AppService,
  ) {}

  @Roles('superadmin')
  @Get()
  async getUsers(@Query() query: any) {
    return this.appService.envelope(await this.usersService.getUsers(query), '鑾峰彇鎴愬姛');
  }

  @Roles('superadmin')
  @Post()
  async createUser(@Body() body: any) {
    return this.appService.envelope(await this.usersService.createUser(body), '鍒涘缓鎴愬姛');
  }

  @Get('profile')
  async getUserProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.appService.envelope(
      await this.usersService.getCurrentUserProfile(currentUser),
      '鑾峰彇鎴愬姛',
    );
  }

  @Put('profile')
  async updateUserProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: any,
  ) {
    return this.appService.envelope(
      await this.usersService.updateCurrentUserProfile(currentUser, body),
      '鏇存柊鎴愬姛',
    );
  }

  @Put('password')
  async updatePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: any,
  ) {
    return this.appService.envelope(
      await this.usersService.updateCurrentUserPassword(currentUser, body),
      '淇敼鎴愬姛',
    );
  }

  @Roles('superadmin')
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.appService.envelope(await this.usersService.getUser(id), '鑾峰彇鎴愬姛');
  }

  @Roles('superadmin')
  @Patch(':id')
  async patchUser(@Param('id') id: string, @Body() body: any) {
    return this.appService.envelope(await this.usersService.updateUser(id, body), '鏇存柊鎴愬姛');
  }

  @Roles('superadmin')
  @Patch(':id/password')
  async patchUserPassword(@Param('id') id: string, @Body() body: any) {
    return this.appService.envelope(
      await this.usersService.updateUserPassword(id, body),
      '淇敼鎴愬姛',
    );
  }

  @Roles('superadmin')
  @Post(':id/reset-password')
  async resetUserPassword(@Param('id') id: string, @Body() body: any) {
    return this.appService.envelope(
      await this.usersService.resetUserPassword(id, body),
      '閲嶇疆鎴愬姛',
    );
  }

  @Roles('superadmin')
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.appService.envelope(await this.usersService.deleteUser(id), '鍒犻櫎鎴愬姛');
  }

  @Roles('superadmin')
  @Post('batch-import')
  async importUsers(@Body() body: any) {
    return this.appService.envelope(await this.usersService.importUsers(body), '瀵煎叆鎴愬姛');
  }

  @Roles('superadmin')
  @Post('batch-delete')
  async deleteUsers(@Body() body: any) {
    return this.appService.envelope(await this.usersService.deleteUsers(body), '鍒犻櫎鎴愬姛');
  }
}
