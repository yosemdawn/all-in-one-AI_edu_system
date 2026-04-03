import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from '../app.service';
import { AuthModule } from '../auth/auth.module';
import { AiRulesController } from './ai-rules.controller';
import { AiRulesSeedService } from './ai-rules.seed.service';
import { AiRulesService } from './ai-rules.service';
import { AiRule, AiRuleSchema } from './schemas/ai-rule.schema';

@Module({
  controllers: [AiRulesController],
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: AiRule.name, schema: AiRuleSchema }]),
  ],
  providers: [AiRulesService, AiRulesSeedService, AppService],
  exports: [AiRulesService],
})
export class AiRulesModule {}
