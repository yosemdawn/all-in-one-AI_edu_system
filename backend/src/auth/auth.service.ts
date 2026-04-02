import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuthSession, AuthSessionDocument } from './schemas/auth-session.schema';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService, TokenService } from './auth.helpers';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuthSession.name)
    private readonly authSessionModel: Model<AuthSessionDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly appService: AppService,
  ) {}

  async login(body: LoginDto) {
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

    this.assertTokenFreshForUser(user, matchedSession.createdAt);

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

  async logout(authorization?: string) {
    if (!authorization) {
      return this.appService.envelope({ success: true }, '退出成功');
    }

    const user = await this.getUserFromAuthorization(authorization);
    user.lastLogoutAt = new Date();
    await user.save();

    await this.authSessionModel.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return this.appService.envelope({ success: true }, '退出成功');
  }

  async profile(authorization?: string) {
    const user = await this.getUserFromAuthorization(authorization);
    return this.appService.envelope({ user: this.toProfilePayload(user) }, '获取成功');
  }

  async register(body: RegisterDto) {
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

    let classItem: ClassDocument | null = null;
    if (body.classId) {
      classItem = await this.classModel.findById(body.classId);
      if (!classItem) {
        throw new BadRequestException('班级不存在');
      }
      if (classItem.status !== 'active') {
        throw new BadRequestException('当前班级不可加入');
      }
      if ((classItem.studentCount || 0) >= (classItem.maxStudents || 60)) {
        throw new BadRequestException('班级人数已满');
      }
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
      classId: classItem?.id,
      className: classItem?.name,
    });

    if (classItem) {
      await this.membershipModel.create({
        classId: classItem.id,
        studentId: user.id,
        studentName: user.name,
        studentNumber: user.studentId,
        status: 'active',
        joinMethod: 'register',
        joinedAt: new Date(),
        totalSubmissions: 0,
        lastSubmissionTime: null,
      });

      classItem.studentCount += 1;
      await classItem.save();
    }

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
    user.lastLogoutAt = new Date();
    if (!user.firstLoginAt) {
      user.firstLoginAt = new Date();
    }
    await user.save();

    await this.authSessionModel.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

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

    this.assertTokenFreshForUser(user, decoded.iat);
    return user;
  }

  private assertTokenFreshForUser(user: UserDocument, issuedAt?: number | Date) {
    const issuedAtDate =
      issuedAt instanceof Date
        ? issuedAt
        : issuedAt
          ? new Date(issuedAt * 1000)
          : null;

    if (
      issuedAtDate &&
      user.lastLogoutAt &&
      user.lastLogoutAt.getTime() > issuedAtDate.getTime()
    ) {
      throw new UnauthorizedException('登录已失效');
    }

    if (
      issuedAtDate &&
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() > issuedAtDate.getTime()
    ) {
      throw new UnauthorizedException('登录已失效');
    }
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
