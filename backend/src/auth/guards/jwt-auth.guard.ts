import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE } from '../decorators/allow-password-change.decorator';
import { Request } from 'express';
import { AuthContextService } from '../auth-context.service';
import { AuthenticatedUser } from '../authenticated-user.interface';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authContextService: AuthContextService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authContextService.authenticate(
      request.headers.authorization,
    );
    if (
      request.user.mustChangePassword &&
      !this.reflector.get<boolean>(ALLOW_PASSWORD_CHANGE, context.getHandler())
    ) {
      throw new ForbiddenException({
        message: '请先修改初始密码',
        errorCode: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
    return true;
  }
}
