import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToNumber } from '../../common/dto/transformers';

export class LogQueryDto {
  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsIn([
    'timestamp',
    'createdAt',
    'responseTime',
    'statusCode',
    'method',
    'endpoint',
  ])
  sortField?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn([
    'timestamp',
    'createdAt',
    'responseTime',
    'statusCode',
    'method',
    'endpoint',
  ])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
