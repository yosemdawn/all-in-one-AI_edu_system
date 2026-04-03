import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToNumber, ToStringArray } from '../../common/dto/transformers';

export class AiRuleListQueryDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsIn(['private', 'public', 'system'])
  visibility?: 'private' | 'public' | 'system';

  @IsOptional()
  @IsIn(['doubao', 'deepseek'])
  modelType?: 'doubao' | 'deepseek';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ToStringArray()
  @IsString({ each: true })
  tags?: string[];

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
  pageSize?: number;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'modelType', 'status', 'visibility'])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;
}
