import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { TrimString } from '../../common/dto/transformers';

export class LoginDto {
  @TrimString()
  @IsString()
  usernameOrEmailOrStudentId: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
