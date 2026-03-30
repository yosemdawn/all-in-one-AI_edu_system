import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from '../app.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { PasswordService, TokenService } from './auth.helpers';
import { AuthSession, AuthSessionSchema } from './schemas/auth-session.schema';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'dev-secret',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
    ]),
  ],
  providers: [AuthService, PasswordService, TokenService, AppService],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
