import { IsArray, IsString } from 'class-validator';

export class UpdateStudentStatusDto {
  @IsArray()
  studentIds: string[];

  @IsString()
  status: string;
}
