import { IsString } from 'class-validator';
import { TrimString } from '../../common/dto/transformers';

export class ForgotPasswordDto {
  @TrimString()
  @IsString()
  username: string;
}
