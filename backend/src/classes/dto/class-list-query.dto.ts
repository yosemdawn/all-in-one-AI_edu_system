import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ClassListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsIn(['name', 'createdAt', 'studentCount'])
  sortField?: 'name' | 'createdAt' | 'studentCount';

  @IsOptional()
  @IsIn(['name', 'createdAt', 'studentCount'])
  sort?: 'name' | 'createdAt' | 'studentCount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
