import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsString()
  MONGODB_URI?: string;

  @IsOptional()
  @IsString()
  TEST_MONGODB_URI?: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  DOUBAO_API_KEY?: string;

  @IsOptional()
  @IsString()
  DOUBAO_BASE_URL?: string;

  @IsOptional()
  @IsString()
  DOUBAO_MODEL?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  SWAGGER_ENABLED?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  ENABLE_DEMO_SEED?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: true,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
