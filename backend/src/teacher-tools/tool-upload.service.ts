import {
  BadRequestException,
  HttpException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, stat, statfs, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { Model } from 'mongoose';
import { ToolTask, ToolTaskDocument } from './schemas/tool-task.schema';
import { TOOL_UPLOAD_DIR } from './teacher-tools.constants';

export const TOOL_UPLOAD_LIMITS = {
  fileBytes: 15 * 1024 * 1024,
  batchBytes: 40 * 1024 * 1024,
  teacherBytes: 2 * 1024 * 1024 * 1024,
  concurrent: 4,
};
export type ToolUploadedFile = Pick<
  Express.Multer.File,
  'originalname' | 'mimetype' | 'size' | 'path'
>;
const imageTypes = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const batchMessage = '这次图片总大小超过 40 MB，请减少几张后分两次上传';

@Injectable()
export class ToolUploadService implements OnModuleInit, OnModuleDestroy {
  private readonly directory = join(
    process.cwd(),
    TOOL_UPLOAD_DIR,
    '.incoming',
  );
  private readonly activeUsers = new Set<string>();
  private readonly activePaths = new Set<string>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @InjectModel(ToolTask.name)
    private readonly tasks: Model<ToolTaskDocument>,
  ) {}

  async onModuleInit() {
    await mkdir(this.directory, { recursive: true });
    await this.cleanStaleFiles();
    this.cleanupTimer = setInterval(
      () => {
        void this.cleanStaleFiles().catch(() => undefined);
      },
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  // Only abandoned incoming files and old preview copies are disposable.
  async cleanStaleFiles() {
    for (const directory of [
      this.directory,
      join(process.cwd(), TOOL_UPLOAD_DIR, 'essay-requirements-preview'),
    ]) {
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return [];
          throw error;
        },
      );
      for (const entry of entries) {
        const path = join(directory, entry.name);
        if (!entry.isFile() || this.activePaths.has(path)) continue;
        const info = await stat(path);
        if (Date.now() - info.mtimeMs > 24 * 60 * 60 * 1000) {
          await unlink(path);
        }
      }
    }
  }

  async run<T>(
    req: Request,
    res: Response,
    teacherId: string,
    fields: multer.Field[],
    handle: () => Promise<T>,
  ): Promise<T> {
    if (
      this.activeUsers.has(teacherId) ||
      this.activeUsers.size >= TOOL_UPLOAD_LIMITS.concurrent
    ) {
      throw new HttpException('正在接收图片，请稍等片刻再试', 429);
    }
    if (Number(req.headers['content-length']) > 50 * 1024 * 1024) {
      throw new PayloadTooLargeException(batchMessage);
    }
    this.activeUsers.add(teacherId);
    const paths = new Set<string>();
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    const timer = setTimeout(() => {
      abort.abort();
      req.destroy();
    }, 120_000);
    timer.unref();
    req.once('aborted', onAbort);
    let totalBytes = 0;
    const writes: Promise<void>[] = [];
    try {
      const disk = await statfs(this.directory);
      if (
        disk.bavail * disk.bsize <
        256 * 1024 * 1024 +
          TOOL_UPLOAD_LIMITS.concurrent * TOOL_UPLOAD_LIMITS.batchBytes
      ) {
        throw new ServiceUnavailableException(
          '图片存储空间不足，请联系管理员清理空间后再试',
        );
      }
      const usedBytes = await this.usedBytes(teacherId);
      const checkQuota = () => {
        if (usedBytes + totalBytes > TOOL_UPLOAD_LIMITS.teacherBytes) {
          throw new PayloadTooLargeException(
            '已保存的图片较多，请联系管理员整理空间后再上传',
          );
        }
      };
      checkQuota();
      const storage: multer.StorageEngine = {
        _handleFile: (_req, file, callback) => {
          const path = join(this.directory, `${randomUUID()}.upload`);
          paths.add(path);
          this.activePaths.add(path);
          let size = 0;
          const counter = new Transform({
            transform(chunk: Buffer, _encoding, done) {
              size += chunk.length;
              totalBytes += chunk.length;
              if (totalBytes > TOOL_UPLOAD_LIMITS.batchBytes) {
                return done(new PayloadTooLargeException(batchMessage));
              }
              try {
                checkQuota();
                done(null, chunk);
              } catch (error) {
                done(error as Error);
              }
            },
          });
          const writing = pipeline(
            file.stream,
            counter,
            createWriteStream(path, { flags: 'wx', mode: 0o600 }),
            {
              signal: abort.signal,
            },
          ).then(
            () => callback(null, { path, size }),
            (error: Error) => callback(error),
          );
          writes.push(writing);
        },
        _removeFile: (_req, file, callback) => {
          void unlink(file.path).then(
            () => callback(null),
            (error: NodeJS.ErrnoException) =>
              callback(error.code === 'ENOENT' ? null : error),
          );
        },
      };
      const fileCount = fields.reduce(
        (sum, field) => sum + (field.maxCount || 0),
        0,
      );
      const limits = {
        fileSize: TOOL_UPLOAD_LIMITS.fileBytes,
        files: fileCount,
        fields: 16,
        fieldSize: 64 * 1024,
        fieldNameSize: 100,
        parts: fileCount + 17,
        fieldNestingDepth: 0,
        fieldArrayIndexLimit: 0,
      };
      const middleware = multer({
        storage,
        limits,
        ...{ defParamCharset: 'utf8' },
        fileFilter: (_req, file, callback) => {
          if (!Object.values(imageTypes).includes(file.mimetype)) {
            return callback(
              new BadRequestException('请上传 JPG、PNG 或 WebP 图片'),
            );
          }
          callback(null, true);
        },
      }).fields(fields);
      await new Promise<void>((resolve, reject) => {
        middleware(req, res, (error: unknown) => {
          if (error)
            reject(error instanceof Error ? error : new Error('Upload failed'));
          else resolve();
        });
      });
      clearTimeout(timer);
      req.off('aborted', onAbort);
      for (const file of Object.values(
        req.files || {},
      ).flat() as ToolUploadedFile[]) {
        await this.validateImage(file);
      }
      return await handle();
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          throw new PayloadTooLargeException(
            '有图片超过 15 MB，请缩小图片后再上传',
          );
        }
        throw new BadRequestException(
          '上传内容过多或格式不正确，请减少图片后重试',
        );
      }
      if (abort.signal.aborted) {
        throw new BadRequestException('上传中断或超时，请检查网络后重新上传');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      req.off('aborted', onAbort);
      abort.abort();
      await Promise.allSettled(writes);
      await Promise.all(
        [...paths].map(async (path) => {
          try {
            await unlink(path);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              // A locked file will be retried by the stale-file cleanup.
            }
          } finally {
            this.activePaths.delete(path);
          }
        }),
      );
      this.activeUsers.delete(teacherId);
    }
  }

  private async usedBytes(teacherId: string) {
    const result = await this.tasks.aggregate<{ bytes: number }>([
      { $match: { teacherId } },
      {
        $project: {
          files: {
            $concatArrays: [
              { $ifNull: ['$config.files', []] },
              { $ifNull: ['$config.essayImages', []] },
              { $ifNull: ['$config.requirementImages', []] },
            ],
          },
        },
      },
      { $unwind: '$files' },
      { $group: { _id: null, bytes: { $sum: '$files.size' } } },
    ]);
    return result[0]?.bytes || 0;
  }

  private async validateImage(file: ToolUploadedFile) {
    try {
      const handle = await open(file.path, 'r');
      const header = Buffer.alloc(12);
      try {
        await handle.read(header, 0, 12, 0);
      } finally {
        await handle.close();
      }
      // Reject other parsers before passing untrusted input to the image library.
      const detected = header
        .subarray(0, 8)
        .equals(Buffer.from('89504e470d0a1a0a', 'hex'))
        ? 'image/png'
        : header.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
          ? 'image/jpeg'
          : header.toString('ascii', 0, 4) === 'RIFF' &&
              header.toString('ascii', 8, 12) === 'WEBP'
            ? 'image/webp'
            : '';
      if (!detected || detected !== file.mimetype)
        throw new Error('Invalid image signature');
      const size = await sharp(file.path, {
        limitInputPixels: 40_000_000,
      }).metadata();
      if (
        !Object.hasOwn(imageTypes, size.format || '') ||
        imageTypes[size.format as keyof typeof imageTypes] !== file.mimetype ||
        !size.width ||
        !size.height ||
        size.width * size.height > 40_000_000 ||
        (size.pages || 1) > 1
      ) {
        throw new Error('Unsupported image');
      }
    } catch {
      throw new BadRequestException(
        '有图片无法读取或分辨率过大，请重新保存为 JPG、PNG 或 WebP 后上传',
      );
    }
  }
}
