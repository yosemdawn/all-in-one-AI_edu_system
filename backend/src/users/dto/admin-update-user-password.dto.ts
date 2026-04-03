import { IsString, MinLength } from 'class-validator';

export class AdminUpdateUserPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword: string;
}
