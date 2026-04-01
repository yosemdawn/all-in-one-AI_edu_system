import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuthSession, AuthSessionDocument } from './schemas/auth-session.schema';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService, TokenService } from './auth.helpers';

@Injectable()
export class AuthService {
  private ensureSeedDataPromise?: Promise<void>;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuthSession.name)
    private readonly authSessionModel: Model<AuthSessionDocument>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly appService: AppService,
  ) {}

  async ensureSeedData() {
    if (this.ensureSeedDataPromise) {
      return this.ensureSeedDataPromise;
    }

    this.ensureSeedDataPromise = (async () => {
      const existing = await this.userModel.countDocuments();
      if (existing > 0) {
        return;
      }

      const passwordHash = await this.passwordService.hash('123456');

      await this.userModel.insertMany([
        {
          username: 'admin',
          email: 'admin@nengdou.local',
          name: '管理员',
          role: 'superadmin',
          status: 'active',
          passwordHash,
        },
        {
          username: 'teacher1',
          email: 'teacher@nengdou.local',
          name: '王老师',
          role: 'teacher',
          status: 'active',
          passwordHash,
        },
        {
          username: 'student1',
          email: 'student@nengdou.local',
          studentId: '20250001',
          name: '张同学',
          role: 'student',
          status: 'active',
          passwordHash,
          classId: 'c-1',
          className: '高一(1)班',
        },
      ]);
    })();

    return this.ensureSeedDataPromise;
  }

  async login(body: LoginDto) {
    await this.ensureSeedData();

    const user = await this.userModel.findOne({
      $or: [
        { email: body.usernameOrEmailOrStudentId },
        { studentId: body.usernameOrEmailOrStudentId },
        { username: body.usernameOrEmailOrStudentId },
      ],
    });

    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const passwordMatched = await this.passwordService.compare(
      body.password,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const accessToken = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
    });
    const refreshToken = this.tokenService.issueRefreshToken();
    const refreshTokenHash = await this.passwordService.hash(refreshToken);

    await this.authSessionModel.create({
      userId: user._id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    user.lastLoginAt = new Date();
    await user.save();

    return this.appService.envelope(
      {
        token: accessToken,
        refreshToken,
        expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
        mustChangePassword: !!user.mustChangePassword,
        isFirstLogin: !user.firstLoginAt,
        user: this.toUserPayload(user),
      },
      '登录成功',
    );
  }

  async refresh(body: RefreshTokenDto) {
    await this.ensureSeedData();

    const sessions = await this.authSessionModel
      .find({ revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 });

    let matchedSession: AuthSessionDocument | null = null;
    for (const session of sessions) {
      const matched = await this.passwordService.compare(
        body.refreshToken,
        session.refreshTokenHash,
      );
      if (matched) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('refresh token 无效');
    }

    const user = await this.userModel.findById(matchedSession.userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    matchedSession.revokedAt = new Date();
    await matchedSession.save();

    const token = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
    });
    const refreshToken = this.tokenService.issueRefreshToken();
    const refreshTokenHash = await this.passwordService.hash(refreshToken);

    await this.authSessionModel.create({
      userId: user._id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return this.appService.envelope(
      {
        token,
        refreshToken,
        expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
      },
      '刷新成功',
    );
  }

  logout() {
    return this.appService.envelope({ success: true }, '退出成功');
  }

  async profile(authorization?: string) {
    const user = await this.getUserFromAuthorization(authorization);
    return this.appService.envelope({ user: this.toProfilePayload(user) }, '获取成功');
  }

  async register(body: RegisterDto) {
    await this.ensureSeedData();

    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    const existingUser = await this.userModel.findOne({
      $or: [{ email: body.email }, { username: body.username }],
    });

    if (existingUser) {
      if (existingUser.email === body.email) {
        throw new BadRequestException('邮箱已存在');
      }
      throw new BadRequestException('用户名已存在');
    }

    const passwordHash = await this.passwordService.hash(body.password);

    const user = await this.userModel.create({
      username: body.username,
      email: body.email,
      studentId: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: body.name || body.username,
      role: 'student',
      status: 'active',
      passwordHash,
      classId: body.classId,
    });

    const token = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
    });

    return this.appService.envelope(
      {
        token,
        success: true,
        message: '注册成功',
        userId: user.id,
        expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
      },
      '注册成功',
    );
  }

  async changePassword(authorization: string | undefined, body: ChangePasswordDto) {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    const user = await this.getUserFromAuthorization(authorization);
    const passwordMatched = await this.passwordService.compare(
      body.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new BadRequestException('当前密码错误');
    }

    user.passwordHash = await this.passwordService.hash(body.newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    if (!user.firstLoginAt) {
      user.firstLoginAt = new Date();
    }
    await user.save();

    return this.appService.envelope({ message: '修改成功' }, '修改成功');
  }

  async firstChangePassword(authorization: string | undefined, body: ChangePasswordDto) {
    return this.changePassword(authorization, body);
  }

  forgotPassword() {
    return this.appService.envelope({ success: true }, '邮件已发送');
  }

  resetPassword() {
    return this.appService.envelope({ success: true }, '重置成功');
  }

  private async getUserFromAuthorization(authorization?: string) {
    const token = authorization?.replace('Bearer ', '').trim();
    if (!token) {
      throw new UnauthorizedException('未登录');
    }

    const decoded = this.tokenService.verifyAccessToken(token);
    const user = await this.userModel.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('登录失效');
    }

    return user;
  }

  private toUserPayload(user: UserDocument) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
      classId: user.classId,
      className: user.className,
      status: user.status,
    };
  }

  private toProfilePayload(user: UserDocument) {
    return {
      ...this.toUserPayload(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      firstLoginAt: user.firstLoginAt,
    };
  }
}
