import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DOUBAO_MODEL_OPTIONS } from '../../common/doubao-models';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(DOUBAO_MODEL_OPTIONS)
  model?: string;
}
