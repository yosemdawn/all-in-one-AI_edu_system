import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAiRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsIn(['doubao', 'deepseek'])
  modelType?: 'doubao' | 'deepseek';

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @IsIn(['private', 'public', 'system'])
  visibility?: 'private' | 'public' | 'system';

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
