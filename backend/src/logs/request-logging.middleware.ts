import {
  Injectable,
  Logger,
  NestMiddleware,
  OnApplicationShutdown,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { LogsService } from './logs.service';

type LoggedRequest = Request & {
  user?: AuthenticatedUser;
};

type ResponseSender = (body?: unknown) => Response;

@Injectable()
export class RequestLoggingMiddleware
  implements NestMiddleware, OnApplicationShutdown
{
  private readonly logger = new Logger(RequestLoggingMiddleware.name);
  private isShuttingDown = false;

  constructor(private readonly logsService: LogsService) {}

  onApplicationShutdown() {
    this.isShuttingDown = true;
  }

  use(request: LoggedRequest, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const endpoint = request.originalUrl || request.url;

    if (endpoint.startsWith('/api/logs')) {
      next();
      return;
    }

    const requestParams = this.logsService.sanitize({
      params: request.params,
      query: request.query,
      body: request.body as unknown,
    }) as Record<string, unknown>;

    let responsePayload: unknown;
    const originalJson = response.json.bind(response) as ResponseSender;
    const originalSend = response.send.bind(response) as ResponseSender;

    response.json = ((body: unknown) => {
      responsePayload = body;
      return originalJson(body);
    }) as unknown as Response['json'];

    response.send = ((body: unknown) => {
      responsePayload = this.parseBody(body);
      return originalSend(body);
    }) as unknown as Response['send'];

    response.once('finish', () => {
      void this.persistLog(
        request,
        response,
        startedAt,
        endpoint,
        requestParams,
        responsePayload,
      );
    });

    next();
  }

  private async persistLog(
    request: LoggedRequest,
    response: Response,
    startedAt: number,
    endpoint: string,
    requestParams: Record<string, unknown>,
    responsePayload: unknown,
  ) {
    if (this.isShuttingDown) {
      return;
    }

    try {
      const resolvedUser = request.user;
      const username = resolvedUser?.username || this.extractUsername(request);

      await this.logsService.record({
        username,
        userId: resolvedUser?.id,
        ip: this.resolveIp(request),
        method: request.method,
        endpoint,
        statusCode: response.statusCode,
        timestamp: new Date(startedAt),
        responseTime: Date.now() - startedAt,
        requestParams,
        responseData: this.logsService.sanitize(responsePayload) as Record<
          string,
          unknown
        > | null,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('client was closed')
      ) {
        return;
      }

      this.logger.error(
        `Failed to record request log for ${endpoint}`,
        error as Error,
      );
    }
  }

  private extractUsername(request: LoggedRequest) {
    const body = (request.body || {}) as Record<string, unknown>;
    return (
      this.readString(body.username) ||
      this.readString(body.usernameOrStudentId) ||
      this.readString(body.studentId)
    );
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private resolveIp(request: LoggedRequest) {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0];
    return (
      forwardedIp ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    ).trim();
  }

  private parseBody(body: unknown) {
    if (typeof body !== 'string') {
      return body;
    }

    try {
      const parsedBody: unknown = JSON.parse(body);
      return parsedBody;
    } catch {
      return body;
    }
  }
}
