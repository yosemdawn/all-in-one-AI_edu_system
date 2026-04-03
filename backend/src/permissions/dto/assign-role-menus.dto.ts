import { IsArray, IsString } from 'class-validator';

export class AssignRoleMenusDto {
  @IsArray()
  @IsString({ each: true })
  menuIds: string[];
}
