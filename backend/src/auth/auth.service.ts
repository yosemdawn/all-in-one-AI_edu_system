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
import { AuthContextService } from './auth-context.service';
import type { AuthenticatedUser } from './authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService, TokenService } from './auth.helpers';
import { AuthSession, AuthSessionDocument } from './schemas/auth-session.schema';

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
    private readonly authContextService: AuthContextService,
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
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatched = await this.passwordService.compare(
      body.password,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const accessToken = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
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
      'success',
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
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.userModel.findById(matchedSession.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.assertTokenFreshForUser(user, matchedSession.createdAt);

    matchedSession.revokedAt = new Date();
    await matchedSession.save();

    const token = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
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
      'success',
    );
  }

  async logout(currentUser: AuthenticatedUser) {
    const user = await this.getUserById(currentUser.id);
    user.lastLogoutAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await this.authSessionModel.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return this.appService.envelope({ success: true }, 'success');
  }

  async profile(currentUser: AuthenticatedUser) {
    const user = await this.getUserById(currentUser.id);
    return this.appService.envelope({ user: this.toProfilePayload(user) }, 'success');
  }

  async register(body: RegisterDto) {
    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userModel.findOne({
      $or: [{ email: body.email }, { username: body.username }],
    });

    if (existingUser) {
      if (existingUser.email === body.email) {
        throw new BadRequestException('Email already exists');
      }
      throw new BadRequestException('Username already exists');
    }

    let classItem: ClassDocument | null = null;
    if (body.classId) {
      classItem = await this.classModel.findById(body.classId);
      if (!classItem) {
        throw new BadRequestException('Class not found');
      }
      if (classItem.status !== 'active') {
        throw new BadRequestException('Class is not available');
      }
      if ((classItem.studentCount || 0) >= (classItem.maxStudents || 60)) {
        throw new BadRequestException('Class is full');
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
      tokenVersion: user.tokenVersion ?? 0,
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
        message: 'registered',
        userId: user.id,
        expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
      },
      'success',
    );
  }

  async changePassword(currentUser: AuthenticatedUser, body: ChangePasswordDto) {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.getUserById(currentUser.id);
    const passwordMatched = await this.passwordService.compare(
      body.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await this.passwordService.hash(body.newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.lastLogoutAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    if (!user.firstLoginAt) {
      user.firstLoginAt = new Date();
    }
    await user.save();

    await this.authSessionModel.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return this.appService.envelope({ message: 'password updated' }, 'success');
  }

  async firstChangePassword(currentUser: AuthenticatedUser, body: ChangePasswordDto) {
    return this.changePassword(currentUser, body);
  }

  forgotPassword() {
    return this.appService.envelope({ success: true }, 'success');
  }

  resetPassword() {
    return this.appService.envelope({ success: true }, 'success');
  }

  private async getUserById(userId: string) {
    return this.authContextService.requireUser(userId);
  }

  private assertTokenFreshForUser(user: UserDocument, issuedAt?: number | Date) {
    const issuedAtSeconds =
      issuedAt instanceof Date
        ? Math.floor(issuedAt.getTime() / 1000)
        : issuedAt ?? null;

    if (
      issuedAtSeconds !== null &&
      user.lastLogoutAt &&
      Math.floor(user.lastLogoutAt.getTime() / 1000) > issuedAtSeconds
    ) {
      throw new UnauthorizedException('Login expired');
    }

    if (
      issuedAtSeconds !== null &&
      user.passwordChangedAt &&
      Math.floor(user.passwordChangedAt.getTime() / 1000) > issuedAtSeconds
    ) {
      throw new UnauthorizedException('Login expired');
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
