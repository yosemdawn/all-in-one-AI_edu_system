import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';

@Injectable()
export class RequestThrottlerGuard extends ThrottlerGuard {
  @Inject(AuthContextService)
  private readonly authContext: AuthContextService;

  protected async getTracker(req: Request): Promise<string> {
    if (req.headers.authorization) {
      try {
        const user = await this.authContext.authenticate(
          req.headers.authorization,
        );
        return `user:${user.id}`;
      } catch {
        // Invalid credentials never create a new per-user bucket.
      }
    }
    return `ip:${req.ip || req.socket.remoteAddress}`;
  }
}
