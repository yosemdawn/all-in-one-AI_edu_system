import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToNumber } from '../../common/dto/transformers';

export class UserListQueryDto {
  @IsOptional()
  @IsIn(['superadmin', 'teacher', 'student'])
  role?: 'superadmin' | 'teacher' | 'student';

  @IsOptional()
  @IsIn(['active', 'inactive', 'locked'])
  status?: 'active' | 'inactive' | 'locked';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  search?: string;

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
  @IsIn([
    'createdAt',
    'updatedAt',
    'username',
    'name',
    'role',
    'status',
    'studentId',
  ])
  sortField?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;

  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'username',
    'name',
    'role',
    'status',
    'studentId',
  ])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;
}
