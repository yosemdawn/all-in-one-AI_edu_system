import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { LogQueryDto } from './dto/log-query.dto';
import { LogEntry, LogEntryDocument } from './schemas/log-entry.schema';

type Serializable =
  | null
  | undefined
  | string
  | number
  | boolean
  | Date
  | Serializable[]
  | { [key: string]: Serializable };

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'passwordhash',
  'token',
  'refreshtoken',
  'resettoken',
  'passwordresettokenhash',
  'authorization',
  'apikey',
  'accesskey',
  'secretkey',
]);

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(LogEntry.name)
    private readonly logEntryModel: Model<LogEntryDocument>,
    private readonly appService: AppService,
  ) {}

  async record(payload: {
    username?: string;
    userId?: string;
    ip: string;
    method: string;
    endpoint: string;
    statusCode: number;
    timestamp: Date;
    responseTime: number;
    requestParams?: Record<string, unknown> | null;
    responseData?: Record<string, unknown> | null;
  }) {
    await this.logEntryModel.create(payload);
  }

  async getLogs(query: LogQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query?.username) {
      filter.username = { $regex: query.username.trim(), $options: 'i' };
    }
    if (query?.userId) {
      filter.userId = query.userId.trim();
    }
    if (query?.ip) {
      filter.ip = { $regex: query.ip.trim(), $options: 'i' };
    }
    if (query?.endpoint) {
      filter.endpoint = { $regex: query.endpoint.trim(), $options: 'i' };
    }
    if (query?.startDate || query?.endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (query.startDate) {
        timestampFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        timestampFilter.$lte = new Date(query.endDate);
      }
      filter.timestamp = timestampFilter;
    }

    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 20);
    const skip = (page - 1) * limit;
    const sortField = query?.sortField || query?.sort || 'timestamp';
    const sortOrder = (query?.sortOrder || query?.order) === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.logEntryModel
        .find(filter)
        .sort({ [sortField]: sortOrder, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.logEntryModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toPayload(item)),
        total,
        page,
        limit,
      },
      'success',
    );
  }

  sanitize<T>(value: T): Serializable {
    return this.sanitizeValue(value, 0);
  }

  private sanitizeValue(value: unknown, depth: number): Serializable {
    if (value === null || value === undefined) {
      return value;
    }

    if (depth >= 6) {
      return '[Truncated]';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, depth + 1));
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return Object.entries(record).reduce<Record<string, Serializable>>(
        (result, [key, item]) => {
          if (this.isSensitiveKey(key)) {
            result[key] = '[REDACTED]';
            return result;
          }

          result[key] = this.sanitizeValue(item, depth + 1);
          return result;
        },
        {},
      );
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'symbol') {
      return value.description ? `[Symbol:${value.description}]` : '[Symbol]';
    }

    return '[Unsupported value]';
  }

  private isSensitiveKey(key: string) {
    return SENSITIVE_KEYS.has(key.toLowerCase());
  }

  private toPayload(item: LogEntry & { _id: { toString(): string } | string }) {
    return {
      id: item._id.toString(),
      username: item.username,
      userId: item.userId,
      ip: item.ip,
      method: item.method,
      endpoint: item.endpoint,
      statusCode: item.statusCode,
      timestamp: item.timestamp,
      responseTime: item.responseTime,
      requestParams: item.requestParams,
      responseData: item.responseData,
    };
  }
}
