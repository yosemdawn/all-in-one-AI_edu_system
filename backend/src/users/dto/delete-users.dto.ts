import { IsArray, IsString } from 'class-validator';

export class DeleteUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
