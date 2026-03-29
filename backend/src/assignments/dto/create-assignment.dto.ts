import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  description: string;

  @IsArray()
  classes: string[];

  @IsOptional()
  @IsObject()
  aiRule?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  questionMaterial?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  referenceAnswer?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  gradingNotes?: string;

  @IsOptional()
  @IsIn(['answer_sheet', 'answers_only', 'mixed'])
  submissionFormat?: 'answer_sheet' | 'answers_only' | 'mixed';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  allowAttachments?: boolean;
}
