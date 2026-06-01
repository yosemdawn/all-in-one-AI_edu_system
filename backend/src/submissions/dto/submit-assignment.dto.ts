import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SubmitAssignmentDto {
  @IsString()
  assignmentId: string;

  @IsString()
  classId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  onlineAnswers?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
