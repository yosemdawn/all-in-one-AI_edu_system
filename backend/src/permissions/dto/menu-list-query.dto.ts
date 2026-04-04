import { IsIn, IsOptional, IsString } from 'class-validator';
import { ToBoolean } from '../../common/dto/transformers';

export class MenuListQueryDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsIn(['menu', 'button'])
  type?: 'menu' | 'button';

  @IsOptional()
  @ToBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @ToBoolean()
  tree?: boolean;

  @IsOptional()
  @IsIn(['sort', 'createdAt', 'updatedAt', 'name', 'path', 'code'])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['sort', 'createdAt', 'updatedAt', 'name', 'path', 'code'])
  sortField?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
