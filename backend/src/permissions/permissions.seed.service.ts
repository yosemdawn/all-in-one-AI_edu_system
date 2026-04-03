import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SYSTEM_MENUS, SYSTEM_ROLES } from './permissions.seed';
import { Menu, MenuDocument } from './schemas/menu.schema';
import { Role, RoleDocument } from './schemas/role.schema';
import { UserRoleAssignment, UserRoleAssignmentDocument } from './schemas/user-role.schema';

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
    await Promise.all(
      SYSTEM_MENUS.map((menu) =>
        this.menuModel.updateOne({ _id: menu._id }, { $setOnInsert: menu }, { upsert: true }),
      ),
    );

    await Promise.all(
      SYSTEM_ROLES.map((role) =>
        this.roleModel.updateOne({ _id: role._id }, { $setOnInsert: role }, { upsert: true }),
      ),
    );

    const users = await this.userModel.find().lean();
    const roleIdByCode = new Map(SYSTEM_ROLES.map((role) => [role.code, role._id]));

    await Promise.all(
      users.map((user) => {
        const roleId = roleIdByCode.get(user.role);
        if (!roleId) {
          return Promise.resolve();
        }

        return this.userRoleModel.updateOne(
          { userId: user._id.toString() },
          { $setOnInsert: { userId: user._id.toString(), roleIds: [roleId] } },
          { upsert: true },
        );
      }),
    );
  }
}
