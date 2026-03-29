import { IsString } from 'class-validator';

export class DeleteSubmissionDto {
  @IsString()
  submissionId: string;
}
