import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

export class TeacherReviewDto {
  @IsString()
  submissionId: string;

  @IsInt()
  @Min(0)
  revision: number;

  @IsString()
  teacherReviewContent: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  teacherScore: number;
}
