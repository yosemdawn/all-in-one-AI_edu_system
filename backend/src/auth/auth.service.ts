import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { AppService } from '../app.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuthContextService } from './auth-context.service';
import type { AuthenticatedUser } from './authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordService, TokenService } from './auth.helpers';
import {
  AuthSession,
  AuthSessionDocument,
} from './schemas/auth-session.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuthSession.name)
    private readonly authSessionModel: Model<AuthSessionDocument>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly authContextService: AuthContextService,
    private readonly appService: AppService,
  ) {}

  async login(body: LoginDto) {
    const credential = body.usernameOrEmailOrStudentId.trim();
    const normalizedEmail = credential.toLowerCase();

    const user = await this.userModel.findOne({
      $or: [
        { email: normalizedEmail },
        { studentId: credential },
        { username: credential },
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatched = await this.comparePassword(
      body.password,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid username or password');
    }

    this.assertUserCanAuthenticate(user);

    const accessToken = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    });
    const refreshToken = await this.createRefreshSession(user._id);

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
    const matchedSession = await this.findRefreshSession(body.refreshToken);

    if (!matchedSession) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.userModel.findById(matchedSession.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.assertUserCanAuthenticate(user);
    this.assertTokenFreshForUser(user, matchedSession.createdAt);

    matchedSession.revokedAt = new Date();
    await matchedSession.save();

    const token = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    });
    const refreshToken = await this.createRefreshSession(user._id);

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
    return this.appService.envelope(
      { user: this.toProfilePayload(user) },
      'success',
    );
  }

  async register(body: RegisterDto) {
    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const normalizedEmail = body.email.toLowerCase().trim();
    const normalizedUsername = body.username.trim();
    const normalizedName = body.name?.trim() || normalizedUsername;

    const existingUser = await this.userModel.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      if (existingUser.email === body.email) {
        throw new BadRequestException('Email already exists');
      }
      throw new BadRequestException('Username already exists');
    }

    const passwordHash = await this.hashPassword(body.password);

    const user = await this.userModel.create({
      username: normalizedUsername,
      email: normalizedEmail,
      studentId: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: normalizedName,
      role: 'student',
      status: 'active',
      passwordHash,
    });

    const token = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    });
    const refreshToken = await this.createRefreshSession(user._id);

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

  async changePassword(
    currentUser: AuthenticatedUser,
    body: ChangePasswordDto,
  ) {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.getUserById(currentUser.id);
    const passwordMatched = await this.comparePassword(
      body.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await this.hashPassword(body.newPassword);
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

  async firstChangePassword(
    currentUser: AuthenticatedUser,
    body: ChangePasswordDto,
  ) {
    return this.changePassword(currentUser, body);
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const user = await this.userModel.findOne({
      email: body.email.toLowerCase().trim(),
    });
    if (!user) {
      return this.appService.envelope(
        {
          success: true,
          message: 'If the account exists, a reset token has been issued.',
        },
        'success',
      );
    }

    const resetToken = randomBytes(24).toString('hex');
    user.passwordResetTokenHash = await this.hashPassword(resetToken);
    user.passwordResetTokenFingerprint =
      this.createTokenFingerprint(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    return this.appService.envelope(
      {
        success: true,
        message: 'If the account exists, a reset token has been issued.',
        ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
      },
      'success',
    );
  }

  async resetPassword(body: ResetPasswordDto) {
    if ((body.confirmPassword || body.password) !== body.password) {
      throw new BadRequestException('Passwords do not match');
    }

    const matchedUser = await this.findUserByResetToken(body.token);

    if (!matchedUser) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    matchedUser.passwordHash = await this.hashPassword(body.password);
    matchedUser.passwordChangedAt = new Date();
    matchedUser.mustChangePassword = false;
    matchedUser.lastLogoutAt = new Date();
    matchedUser.tokenVersion = (matchedUser.tokenVersion ?? 0) + 1;
    matchedUser.passwordResetTokenHash = null;
    matchedUser.passwordResetTokenFingerprint = null;
    matchedUser.passwordResetExpiresAt = null;
    if (!matchedUser.firstLoginAt) {
      matchedUser.firstLoginAt = new Date();
    }
    await matchedUser.save();

    await this.authSessionModel.updateMany(
      { userId: matchedUser._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return this.appService.envelope({ success: true }, 'success');
  }

  private async getUserById(userId: string) {
    return this.authContextService.requireUser(userId);
  }

  private async hashPassword(password: string): Promise<string> {
    const hashedPassword = await this.passwordService.hash(password);
    return hashedPassword;
  }

  private async comparePassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const isMatched = await this.passwordService.compare(
      password,
      passwordHash,
    );
    return isMatched;
  }

  private async createRefreshSession(userId: UserDocument['_id']) {
    const refreshToken = this.tokenService.issueRefreshToken();
    const refreshTokenHash = await this.hashPassword(refreshToken);

    await this.authSessionModel.create({
      userId,
      refreshTokenHash,
      refreshTokenFingerprint: this.createTokenFingerprint(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return refreshToken;
  }

  private async findRefreshSession(refreshToken: string) {
    const refreshTokenFingerprint = this.createTokenFingerprint(refreshToken);
    const activeSessionFilter = {
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    };

    const matchedSession = await this.authSessionModel
      .findOne({
        ...activeSessionFilter,
        refreshTokenFingerprint,
      })
      .sort({ createdAt: -1 });

    if (matchedSession) {
      return matchedSession;
    }

    const legacySessions = await this.authSessionModel
      .find({
        ...activeSessionFilter,
        $or: [
          { refreshTokenFingerprint: { $exists: false } },
          { refreshTokenFingerprint: null },
        ],
      })
      .sort({ createdAt: -1 });

    for (const session of legacySessions) {
      const matched = await this.comparePassword(
        refreshToken,
        session.refreshTokenHash,
      );
      if (matched) {
        session.refreshTokenFingerprint = refreshTokenFingerprint;
        await session.save();
        return session;
      }
    }

    return null;
  }

  private async findUserByResetToken(resetToken: string) {
    const passwordResetTokenFingerprint =
      this.createTokenFingerprint(resetToken);
    const activeResetTokenFilter = {
      passwordResetExpiresAt: { $gt: new Date() },
    };

    const matchedUser = await this.userModel.findOne({
      ...activeResetTokenFilter,
      passwordResetTokenFingerprint,
    });

    if (matchedUser?.passwordResetTokenHash) {
      const matched = await this.comparePassword(
        resetToken,
        matchedUser.passwordResetTokenHash,
      );
      if (matched) {
        return matchedUser;
      }
    }

    const legacyCandidates = await this.userModel.find({
      ...activeResetTokenFilter,
      passwordResetTokenHash: { $ne: null },
      $or: [
        { passwordResetTokenFingerprint: { $exists: false } },
        { passwordResetTokenFingerprint: null },
      ],
    });

    for (const candidate of legacyCandidates) {
      if (!candidate.passwordResetTokenHash) {
        continue;
      }

      const matched = await this.comparePassword(
        resetToken,
        candidate.passwordResetTokenHash,
      );
      if (matched) {
        candidate.passwordResetTokenFingerprint = passwordResetTokenFingerprint;
        await candidate.save();
        return candidate;
      }
    }

    return null;
  }

  private createTokenFingerprint(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertTokenFreshForUser(
    user: UserDocument,
    issuedAt?: number | Date,
  ) {
    const issuedAtSeconds =
      issuedAt instanceof Date
        ? Math.floor(issuedAt.getTime() / 1000)
        : (issuedAt ?? null);

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

  private assertUserCanAuthenticate(user: UserDocument) {
    if (user.status === 'locked') {
      throw new UnauthorizedException('Account is locked');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is inactive');
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
