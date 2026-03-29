import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  maxStudents?: number;
}
