import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToNumber } from '../../common/dto/transformers';

export class AssignmentStudentsQueryDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  studentName?: string;

  @IsOptional()
  @IsString()
  studentNumber?: string;

  @IsOptional()
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
