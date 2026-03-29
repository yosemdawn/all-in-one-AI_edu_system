import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  maxStudents?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
