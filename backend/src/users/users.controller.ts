import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppService } from '../app.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminUpdateUserPasswordDto } from './dto/admin-update-user-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUsersDto } from './dto/delete-users.dto';
import { ImportUserRowDto } from './dto/import-user-row.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
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
  async getUsers(@Query() query: UserListQueryDto) {
    return this.appService.envelope(
      await this.usersService.getUsers(query),
      'users fetched',
    );
  }

  @Roles('superadmin')
  @Post()
  async createUser(@Body() body: CreateUserDto) {
    return this.appService.envelope(
      await this.usersService.createUser(body),
      'user created',
    );
  }

  @Get('profile')
  async getUserProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.appService.envelope(
      await this.usersService.getCurrentUserProfile(currentUser),
      'profile fetched',
    );
  }

  @Put('profile')
  async updateUserProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateUserProfileDto,
  ) {
    return this.appService.envelope(
      await this.usersService.updateCurrentUserProfile(currentUser, body),
      'profile updated',
    );
  }

  @Put('password')
  async updatePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateUserPasswordDto,
  ) {
    return this.appService.envelope(
      await this.usersService.updateCurrentUserPassword(currentUser, body),
      'password updated',
    );
  }

  @Roles('superadmin')
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.appService.envelope(
      await this.usersService.getUser(id),
      'user fetched',
    );
  }

  @Roles('superadmin')
  @Patch(':id')
  async patchUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.appService.envelope(
      await this.usersService.updateUser(id, body),
      'user updated',
    );
  }

  @Roles('superadmin')
  @Patch(':id/password')
  async patchUserPassword(
    @Param('id') id: string,
    @Body() body: AdminUpdateUserPasswordDto,
  ) {
    return this.appService.envelope(
      await this.usersService.updateUserPassword(id, body),
      'password updated',
    );
  }

  @Roles('superadmin')
  @Post(':id/reset-password')
  async resetUserPassword(
    @Param('id') id: string,
    @Body() body: ResetUserPasswordDto,
  ) {
    return this.appService.envelope(
      await this.usersService.resetUserPassword(id, body),
      'password reset',
    );
  }

  @Roles('superadmin')
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.appService.envelope(
      await this.usersService.deleteUser(id),
      'user deleted',
    );
  }

  @Roles('superadmin')
  @Post('batch-import')
  async importUsers(
    @Body(new ParseArrayPipe({ items: ImportUserRowDto }))
    body: ImportUserRowDto[],
  ) {
    return this.appService.envelope(
      await this.usersService.importUsers(body),
      'users imported',
    );
  }

  @Roles('superadmin')
  @Post('batch-delete')
  async deleteUsers(@Body() body: DeleteUsersDto) {
    return this.appService.envelope(
      await this.usersService.deleteUsers(body),
      'users deleted',
    );
  }
}
