import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToBoolean, ToNumber } from '../../common/dto/transformers';

export class RoleListQueryDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @ToBoolean()
  isSystem?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  code?: string;

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
  @IsIn(['createdAt', 'updatedAt', 'name', 'code', 'status'])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'code', 'status'])
  sortField?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}
