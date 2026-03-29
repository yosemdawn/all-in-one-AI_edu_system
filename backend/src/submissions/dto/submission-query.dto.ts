import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class SubmissionQueryDto {
  @IsOptional()
  @IsString()
  assignmentId?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  studentName?: string;

  @IsOptional()
  @IsString()
  studentNumber?: string;

  @IsOptional()
  @Type(() => Number)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  maxScore?: number;

  @IsOptional()
  @IsIn(['submittedAt', 'teacherScore', 'aiScore', 'studentName'])
  sortBy?: 'submittedAt' | 'teacherScore' | 'aiScore' | 'studentName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
