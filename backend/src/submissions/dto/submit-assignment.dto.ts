import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SubmitAssignmentDto {
  @IsString()
  assignmentId: string;

  @IsString()
  classId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
