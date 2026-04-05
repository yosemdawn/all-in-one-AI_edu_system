import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean, ToNumber } from '../../common/dto/transformers';

export class CreateMenuDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(100)
  code: string;

  @IsString()
  @MaxLength(200)
  path: string;

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsString()
  redirect?: string;

  @IsOptional()
  @IsIn(['menu', 'button'])
  type?: 'menu' | 'button';

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
