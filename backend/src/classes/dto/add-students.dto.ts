import { IsArray } from 'class-validator';

export class AddStudentsDto {
  @IsArray()
  studentIds: string[];
}
