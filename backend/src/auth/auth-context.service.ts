import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TokenService } from './auth.helpers';
import type { AuthenticatedUser } from './authenticated-user.interface';

@Injectable()
export class AuthContextService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly tokenService: TokenService,
  ) {}

  async authenticate(authorization?: string) {
    const token = authorization?.replace('Bearer ', '').trim();
    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    const decoded = this.tokenService.verifyAccessToken(token);
    const user = await this.userModel.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('Login expired');
    }

    this.assertTokenFreshForUser(user, decoded.iat);
    return this.toAuthenticatedUser(user);
  }

  async requireUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Login expired');
    }

    return user;
  }

  toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      studentId: user.studentId,
      classId: user.classId,
      className: user.className,
      mustChangePassword: user.mustChangePassword,
      firstLoginAt: user.firstLoginAt,
      lastLoginAt: user.lastLoginAt,
      lastLogoutAt: user.lastLogoutAt,
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  private assertTokenFreshForUser(user: UserDocument, issuedAt?: number) {
    const issuedAtSeconds = issuedAt ?? null;
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
}
