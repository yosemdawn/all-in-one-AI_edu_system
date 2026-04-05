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
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

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

  @IsOptional()
  @IsIn(['true', 'false'])
  AI_REVIEW_REQUIRED?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  THROTTLE_TTL?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  AUTH_THROTTLE_TTL?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  AUTH_THROTTLE_LIMIT?: number;
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

  assertProductionReadiness(validatedConfig);

  return validatedConfig;
}

function assertProductionReadiness(config: EnvironmentVariables) {
  if (config.NODE_ENV !== 'production') {
    return;
  }

  requireValue(config.MONGODB_URI, 'MONGODB_URI is required in production');
  requireValue(
    config.CORS_ORIGINS,
    'CORS_ORIGINS is required in production and must list allowed frontend origins',
  );

  const jwtSecret = requireValue(
    config.JWT_SECRET,
    'JWT_SECRET is required in production',
  );
  if (jwtSecret === 'dev-secret' || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be a strong production secret with at least 32 characters',
    );
  }

  if (config.ENABLE_DEMO_SEED === 'true') {
    throw new Error('ENABLE_DEMO_SEED must not be enabled in production');
  }

  const aiReviewRequired = config.AI_REVIEW_REQUIRED !== 'false';
  if (aiReviewRequired) {
    requireValue(
      config.REDIS_URL,
      'REDIS_URL is required in production when AI_REVIEW_REQUIRED is not false',
    );
    requireValue(
      config.DOUBAO_API_KEY,
      'DOUBAO_API_KEY is required in production when AI_REVIEW_REQUIRED is not false',
    );
  }
}

function requireValue(value: string | undefined, message: string) {
  if (!value?.trim()) {
    throw new Error(message);
  }

  return value.trim();
}
