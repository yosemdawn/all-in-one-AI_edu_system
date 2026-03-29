import { IsArray, IsString } from 'class-validator';

export class AddStudentsDto {
  @IsArray()
  studentIds: string[];
}
