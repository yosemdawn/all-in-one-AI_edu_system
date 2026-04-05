import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiReviewConfigService {
  constructor(private readonly configService: ConfigService) {}

  get isProduction() {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  get aiReviewRequired() {
    const configuredValue =
      this.configService.get<string>('AI_REVIEW_REQUIRED');
    if (configuredValue === 'true') {
      return true;
    }
    if (configuredValue === 'false') {
      return false;
    }

    return this.isProduction;
  }

  get redisUrl() {
    return (
      this.configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379'
    );
  }

  get doubaoApiKey() {
    return this.configService.get<string>('DOUBAO_API_KEY') || '';
  }

  get doubaoBaseUrl() {
    return (
      this.configService.get<string>('DOUBAO_BASE_URL') ||
      'https://ark.cn-beijing.volces.com/api/v3'
    );
  }

  get doubaoModel() {
    return (
      this.configService.get<string>('DOUBAO_MODEL') ||
      'doubao-seed-2-0-lite-260215'
    );
  }
}
