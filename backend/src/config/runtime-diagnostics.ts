import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function logRuntimeDiagnostics(configService: ConfigService) {
  const logger = new Logger('Bootstrap');
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const port = configService.get<number>('PORT') ?? 3000;
  const mongodbUri =
    configService.get<string>('MONGODB_URI') ||
    'mongodb://127.0.0.1:27017/nengdou_ai';
  const redisUrl = configService.get<string>('REDIS_URL');
  const jwtSecret = configService.get<string>('JWT_SECRET');
  const doubaoApiKey = configService.get<string>('DOUBAO_API_KEY');
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  const trustProxy = configService.get<string>('TRUST_PROXY');
  const demoSeedEnabled =
    configService.get<string>('ENABLE_DEMO_SEED') === 'true';
  const aiReviewRequired =
    configService.get<string>('AI_REVIEW_REQUIRED') !== 'false';

  logger.log(`Backend running on http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`MongoDB: ${sanitizeConnectionTarget(mongodbUri)}`);
  logger.log(`Redis queue: ${redisUrl ? 'enabled' : 'disabled'}`);
  logger.log(`Doubao AI: ${doubaoApiKey ? 'configured' : 'not configured'}`);
  logger.log(
    `CORS allowlist: ${corsOrigins ? 'configured' : 'open development mode'}`,
  );
  logger.log(`Trust proxy: ${trustProxy || 'disabled'}`);
  logger.log(`AI review required: ${aiReviewRequired ? 'yes' : 'no'}`);

  if (!configService.get<string>('MONGODB_URI')) {
    logger.warn(
      'MONGODB_URI is not configured. Using the default local MongoDB instance.',
    );
  }

  if (!redisUrl) {
    logger.warn(
      'REDIS_URL is not configured. AI review queue will be disabled and submissions will be marked as skipped.',
    );
  }

  if (!doubaoApiKey) {
    logger.warn(
      'DOUBAO_API_KEY is not configured. AI review jobs cannot complete successfully.',
    );
  }

  if (!jwtSecret) {
    logger.warn(
      'JWT_SECRET is not configured. The backend is using the default development secret and is not ready for production exposure.',
    );
  }

  if (nodeEnv === 'production' && !corsOrigins) {
    logger.warn(
      'CORS_ORIGINS is not configured. Production should restrict browser access to approved origins.',
    );
  }

  if (nodeEnv === 'production' && !trustProxy) {
    logger.warn(
      'TRUST_PROXY is not configured. If the backend runs behind a load balancer or reverse proxy, client IP based controls may be inaccurate.',
    );
  }

  if (nodeEnv === 'production' && demoSeedEnabled) {
    logger.warn(
      'ENABLE_DEMO_SEED=true in production. Demo data seeding is enabled and should be reviewed before launch.',
    );
  }

  if (nodeEnv === 'production' && aiReviewRequired && !redisUrl) {
    logger.warn(
      'AI_REVIEW_REQUIRED is enabled in production but REDIS_URL is missing.',
    );
  }

  if (nodeEnv === 'production' && aiReviewRequired && !doubaoApiKey) {
    logger.warn(
      'AI_REVIEW_REQUIRED is enabled in production but DOUBAO_API_KEY is missing.',
    );
  }
}

function sanitizeConnectionTarget(uri: string) {
  return uri.replace(/:\/\/([^/]+)@/, '://***@');
}
