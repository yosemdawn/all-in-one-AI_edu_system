import 'reflect-metadata';
import { validateEnvironment } from './env.validation';
describe('Production proxy configuration', () => {
  const config = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(40),
    MONGODB_URI: 'mongodb://localhost/test',
    CORS_ORIGINS: 'https://example.test',
    AI_REVIEW_REQUIRED: 'false',
  };
  it('rejects trusting arbitrary forwarded headers', () => {
    expect(() =>
      validateEnvironment({ ...config, TRUST_PROXY: 'true' }),
    ).toThrow('TRUST_PROXY');
  });
  it('accepts explicit trusted address ranges', () => {
    expect(() =>
      validateEnvironment({ ...config, TRUST_PROXY: 'uniquelocal' }),
    ).not.toThrow();
  });
});
