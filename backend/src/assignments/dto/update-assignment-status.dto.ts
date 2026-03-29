import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAssignmentStatusDto {
  @IsIn(['draft', 'published', 'terminated'])
  status: 'draft' | 'published' | 'terminated';

  @IsOptional()
  @IsString()
  terminatedReason?: string;
}
