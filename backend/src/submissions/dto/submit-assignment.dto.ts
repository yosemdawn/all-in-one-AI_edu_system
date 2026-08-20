import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';
import { ToBoolean } from '../../common/dto/transformers';

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export class SubmitAssignmentDto {
  @IsString()
  assignmentId: string;

  @IsString()
  classId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @Transform(({ value }) => parseStringArray(value))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  retainedAttachmentIds?: string[];

  @IsOptional()
  @IsArray()
  onlineAnswers?: Array<Record<string, unknown>>;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isDraft?: boolean;
}
