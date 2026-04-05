import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToNumber, ToOptionalString } from '../../common/dto/transformers';

export class AssignmentStudentsQueryDto {
  @IsOptional()
  @ToOptionalString(['-1'])
  @IsString()
  classId?: string;

  @IsOptional()
  @ToOptionalString()
  @IsString()
  studentName?: string;

  @IsOptional()
  @ToOptionalString()
  @IsString()
  studentNumber?: string;

  @IsOptional()
  @ToOptionalString(['-1'])
  @IsIn(['submitted', 'draft', 'not_submitted'])
  submissionStatus?: 'submitted' | 'draft' | 'not_submitted';

  @IsOptional()
  @ToOptionalString(['-1'])
  @IsIn(['pending', 'draft', 'submitted', 'ai_reviewed', 'teacher_reviewed'])
  gradingStatus?: string;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
