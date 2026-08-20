import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  @IsString()
  endpoint: string;
}
