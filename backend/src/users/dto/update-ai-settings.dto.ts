import { IsString, MinLength } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsString()
  @MinLength(8)
  apiKey: string;
}
