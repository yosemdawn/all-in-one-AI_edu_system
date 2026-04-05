import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpEnvelopeExceptionFilter } from './common/filters/http-exception.filter';
import { logRuntimeDiagnostics } from './config/runtime-diagnostics';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    disable?: (setting: string) => void;
    set?: (setting: string, value: string | number | boolean) => void;
  };
  const trustProxy = parseTrustProxy(configService.get<string>('TRUST_PROXY'));

  app.setGlobalPrefix('api');
  httpAdapter.disable?.('x-powered-by');
  if (trustProxy !== undefined) {
    httpAdapter.set?.('trust proxy', trustProxy);
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.enableCors({
    origin: resolveCorsOrigins(configService, nodeEnv),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new HttpEnvelopeExceptionFilter());

  await app.listen(port);
  logRuntimeDiagnostics(configService);
}
void bootstrap();

function resolveCorsOrigins(configService: ConfigService, nodeEnv: string) {
  const configuredOrigins = configService.get<string>('CORS_ORIGINS');
  if (!configuredOrigins?.trim()) {
    return nodeEnv === 'production' ? [] : true;
  }

  return configuredOrigins
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTrustProxy(value: string | undefined) {
  if (!value || value === 'false') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
}
