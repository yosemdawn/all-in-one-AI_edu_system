import { IsInt, IsMongoId, Min } from 'class-validator';
export class RetryAiReviewDto {
  @IsMongoId()
  submissionId: string;
  @IsInt()
  @Min(0)
  revision: number;
}
