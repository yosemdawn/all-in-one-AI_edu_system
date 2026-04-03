import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ToBoolean, ToNumber } from '../../common/dto/transformers';

export class UpdateAiModelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  lastBalance?: number;

  @IsOptional()
  @IsString()
  balanceCurrency?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isDefault?: boolean;
}
