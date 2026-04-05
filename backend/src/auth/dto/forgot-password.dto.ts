import { IsEmail } from 'class-validator';
import { TrimString } from '../../common/dto/transformers';

export class ForgotPasswordDto {
  @TrimString()
  @IsEmail()
  email: string;
}
