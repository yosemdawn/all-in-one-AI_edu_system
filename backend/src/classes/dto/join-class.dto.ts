import { IsString } from 'class-validator';

export class JoinClassDto {
  @IsString()
  code: string;
}
