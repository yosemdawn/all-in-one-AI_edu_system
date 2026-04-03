import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class PasswordService {
  async hash(password: string) {
    return bcrypt.hash(password, 10);
  }

  async compare(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issueAccessToken(payload: { sub: string; role: string; tokenVersion: number }) {
    const secret = this.configService.get<string>('JWT_SECRET') ?? 'dev-secret';
    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '24h',
    });
  }

  issueRefreshToken() {
    return randomUUID();
  }

  getAccessTokenExpiresInSeconds() {
    return 60 * 60 * 24;
  }

  verifyAccessToken(token: string) {
    const secret = this.configService.get<string>('JWT_SECRET') ?? 'dev-secret';
    return this.jwtService.verify<{
      sub: string;
      role: string;
      tokenVersion: number;
      iat?: number;
    }>(token, {
      secret,
    });
  }
}
