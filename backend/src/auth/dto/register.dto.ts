import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { TrimString } from '../../common/dto/transformers';

export class RegisterDto {
  @TrimString()
  @IsString()
  username: string;

  @TrimString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  confirmPassword: string;

  @TrimString()
  @IsOptional()
  @IsString()
  name?: string;
}
