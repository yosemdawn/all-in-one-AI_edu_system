import { Type } from 'class-transformer';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class TeacherReviewDto {
  @IsString()
  submissionId: string;

  @IsString()
  teacherReviewContent: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  teacherScore: number;
}
