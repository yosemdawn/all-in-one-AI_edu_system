import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return backend readiness envelope', () => {
      expect(appController.getHello()).toEqual({
        code: 200,
        message: 'backend ready',
        data: {
          name: 'nengdou-backend',
          ok: true,
        },
      });
    });
  });
});
