import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from '../app.service';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PermissionsController } from './permissions.controller';
import { PermissionsSeedService } from './permissions.seed.service';
import { PermissionsService } from './permissions.service';
import { Menu, MenuSchema } from './schemas/menu.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import {
  UserRoleAssignment,
  UserRoleAssignmentSchema,
} from './schemas/user-role.schema';

@Module({
  controllers: [PermissionsController],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Menu.name, schema: MenuSchema },
      { name: Role.name, schema: RoleSchema },
      { name: UserRoleAssignment.name, schema: UserRoleAssignmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [PermissionsService, PermissionsSeedService, AppService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
