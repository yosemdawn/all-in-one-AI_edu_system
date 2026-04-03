import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CompatLoginDto {
  @IsOptional()
  @IsString()
  usernameOrEmailOrStudentId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
