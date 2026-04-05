import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { TrimString } from '../../common/dto/transformers';

export class CompatRegisterDto {
  @TrimString()
  @IsOptional()
  @IsString()
  username?: string;

  @TrimString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @TrimString()
  @IsString()
  name: string;

  @TrimString()
  @IsOptional()
  @IsString()
  classId?: string;
}
