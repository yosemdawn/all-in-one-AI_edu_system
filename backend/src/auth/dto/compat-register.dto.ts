import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CompatRegisterDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  classId?: string;
}
