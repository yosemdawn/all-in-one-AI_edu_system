import { IsString, MinLength } from 'class-validator';

export class ParseTextDto {
  @IsString()
  @MinLength(1)
  text: string;
}

