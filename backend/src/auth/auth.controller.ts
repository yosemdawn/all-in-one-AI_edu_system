import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompatLoginDto } from './dto/compat-login.dto';
import { CompatRegisterDto } from './dto/compat-register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({
    auth: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @Post('v1/auth/login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Throttle({
    auth: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @Post('auth/login')
  loginCompat(@Body() body: CompatLoginDto) {
    const usernameOrEmailOrStudentId =
      body.usernameOrEmailOrStudentId || body.email || body.username;
    if (!usernameOrEmailOrStudentId) {
      throw new BadRequestException(
        'usernameOrEmailOrStudentId, email, or username is required',
      );
    }

    return this.authService.login({
      usernameOrEmailOrStudentId,
      password: body.password,
      rememberMe: body.rememberMe,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('v1/auth/logout')
  logout(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.logout(currentUser);
  }

  @Throttle({
    auth: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @Post('v1/auth/refresh-token')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('v1/auth/profile')
  profile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.profile(currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Put('v1/auth/password')
  changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(currentUser, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('v1/auth/first-password-change')
  firstChangePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.firstChangePassword(currentUser, body);
  }

  @Throttle({
    auth: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @Post('v1/auth/forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Throttle({
    auth: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @Post('v1/auth/reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Throttle({
    auth: {
      limit: 3,
      ttl: 60_000,
    },
  })
  @Post('v1/auth/register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Throttle({
    auth: {
      limit: 3,
      ttl: 60_000,
    },
  })
  @Post('auth/register')
  registerCompat(@Body() body: CompatRegisterDto) {
    return this.authService.register({
      username: body.username || body.email || body.name,
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword || body.password,
      name: body.name,
      classId: body.classId,
    });
  }
}
