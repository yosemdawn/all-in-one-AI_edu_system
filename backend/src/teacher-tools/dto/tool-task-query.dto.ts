import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class ToolTaskQueryDto {
  @IsOptional()
  @IsIn(['objective_grading', 'essay_batch'])
  type?: 'objective_grading' | 'essay_batch';

  @IsOptional()
  @IsIn([
    'queued',
    'processing',
    'completed',
    'partial_failed',
    'failed',
    'cancelled',
  ])
  status?:
    | 'queued'
    | 'processing'
    | 'completed'
    | 'partial_failed'
    | 'failed'
    | 'cancelled';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

