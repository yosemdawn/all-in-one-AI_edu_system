import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Field } from 'multer';
import { defer, lastValueFrom } from 'rxjs';
import { ToolUploadService } from './tool-upload.service';

export function ToolUploadInterceptor(fields: Field[]): Type<NestInterceptor> {
  @Injectable()
  class UploadInterceptor implements NestInterceptor {
    constructor(private readonly uploads: ToolUploadService) {}

    intercept(context: ExecutionContext, next: CallHandler) {
      const http = context.switchToHttp();
      const request = http.getRequest<Request & { user: { id: string } }>();
      return defer(() =>
        this.uploads.run(
          request,
          http.getResponse<Response>(),
          request.user.id,
          fields,
          () => lastValueFrom(next.handle()),
        ),
      );
    }
  }
  return mixin(UploadInterceptor);
}
