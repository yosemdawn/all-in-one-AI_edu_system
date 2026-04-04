import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SYSTEM_MENUS, SYSTEM_ROLES } from './permissions.seed';
import { Menu, MenuDocument } from './schemas/menu.schema';
import { Role, RoleDocument } from './schemas/role.schema';
import {
  UserRoleAssignment,
  UserRoleAssignmentDocument,
} from './schemas/user-role.schema';

@Injectable()
export class PermissionsSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Menu.name)
    private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(UserRoleAssignment.name)
    private readonly userRoleModel: Model<UserRoleAssignmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.syncSystemMenus();
    await this.syncSystemRoles();
    await this.syncUserRoleAssignments();
  }

  private async syncSystemMenus() {
    await Promise.all(
      SYSTEM_MENUS.map((menu) =>
        this.menuModel.updateOne(
          { _id: menu._id },
          {
            $set: {
              ...menu,
              isSystem: true,
            },
          },
          { upsert: true },
        ),
      ),
    );
  }

  private async syncSystemRoles() {
    await Promise.all(
      SYSTEM_ROLES.map(async (role) => {
        const existingRole = await this.roleModel.findById(role._id);
        if (!existingRole) {
          await this.roleModel.create(role);
          return;
        }

        existingRole.name = role.name;
        existingRole.code = role.code;
        existingRole.description = role.description;
        existingRole.status = role.status;
        existingRole.isSystem = true;
        existingRole.permissions = [
          ...new Set([
            ...(existingRole.permissions || []),
            ...role.permissions,
          ]),
        ];
        existingRole.menuIds = [
          ...new Set([...(existingRole.menuIds || []), ...role.menuIds]),
        ];
        await existingRole.save();
      }),
    );
  }

  private async syncUserRoleAssignments() {
    const users = await this.userModel.find().lean();
    const roleIdByCode = new Map(
      SYSTEM_ROLES.map((role) => [role.code, role._id]),
    );

    await Promise.all(
      users.map(async (user) => {
        const roleId = roleIdByCode.get(user.role);
        if (!roleId) {
          return;
        }

        const assignment = await this.userRoleModel.findOne({
          userId: user._id.toString(),
        });
        if (!assignment) {
          await this.userRoleModel.create({
            userId: user._id.toString(),
            roleIds: [roleId],
          });
          return;
        }

        if (!assignment.roleIds?.includes(roleId)) {
          assignment.roleIds = [
            ...new Set([...(assignment.roleIds || []), roleId]),
          ];
          await assignment.save();
        }
      }),
    );
  }
}
