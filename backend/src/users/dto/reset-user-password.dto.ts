import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}
