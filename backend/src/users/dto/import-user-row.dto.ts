import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class ImportUserRowDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['superadmin', 'teacher', 'student'])
  role?: 'superadmin' | 'teacher' | 'student';

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'locked'])
  status?: 'active' | 'inactive' | 'locked';

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
