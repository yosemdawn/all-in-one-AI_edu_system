import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { MenuListQueryDto } from './dto/menu-list-query.dto';
import { RoleListQueryDto } from './dto/role-list-query.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Menu, MenuDocument } from './schemas/menu.schema';
import { Role, RoleDocument } from './schemas/role.schema';
import {
  UserRoleAssignment,
  UserRoleAssignmentDocument,
} from './schemas/user-role.schema';

const PRIMARY_ROLE_CODES = new Set(['superadmin', 'teacher', 'student']);
const ALLOWED_ROLE_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'status',
]);

type MenuPayload = {
  _id: string;
  name: string;
  code: string;
  path: string;
  component?: string;
  redirect?: string;
  type: string;
  parentId: string | null;
  icon?: string;
  sort?: number;
  hidden: boolean;
  status: string;
  meta: Record<string, unknown>;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isSystem: boolean;
};

type MenuTreeNode = MenuPayload & {
  children?: MenuTreeNode[];
};

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Menu.name)
    private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(UserRoleAssignment.name)
    private readonly userRoleModel: Model<UserRoleAssignmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly appService: AppService,
  ) {}

  async getResources(currentUser: AuthenticatedUser, requestedUserId: string) {
    const targetUser = await this.getTargetUser(currentUser, requestedUserId);
    const roles = await this.getAssignedRoles(
      targetUser._id.toString(),
      targetUser.role,
    );
    const permissions = [
      ...new Set(roles.flatMap((role) => role.permissions || [])),
    ];
    const menus = await this.getMenusForRoles(roles);

    return this.appService.envelope(
      {
        roles: roles.map((role) => this.toRolePayload(role)),
        permissions,
        menus,
      },
      'success',
    );
  }

  async getUserRoles(currentUser: AuthenticatedUser, requestedUserId: string) {
    const resources = await this.getResources(currentUser, requestedUserId);
    return this.appService.envelope(resources.data.roles, 'success');
  }

  async getUserPermissions(
    currentUser: AuthenticatedUser,
    requestedUserId: string,
  ) {
    const resources = await this.getResources(currentUser, requestedUserId);
    return this.appService.envelope(resources.data.permissions, 'success');
  }

  async getUserMenus(currentUser: AuthenticatedUser, requestedUserId: string) {
    const resources = await this.getResources(currentUser, requestedUserId);
    return this.appService.envelope(resources.data.menus, 'success');
  }

  async assignRolesToUser(
    userId: string,
    roleIds: string[],
    assignedBy: AuthenticatedUser,
  ) {
    const targetUser = await this.userModel.findById(userId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const normalizedRoleIds = [...new Set((roleIds || []).filter(Boolean))];
    if (!normalizedRoleIds.length) {
      throw new BadRequestException('At least one role must be assigned');
    }

    const roles = await this.roleModel.find({
      _id: { $in: normalizedRoleIds },
    });
    if (roles.length !== normalizedRoleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    await this.userRoleModel.updateOne(
      { userId },
      {
        $set: {
          userId,
          roleIds: normalizedRoleIds,
          assignedBy: assignedBy.id,
        },
      },
      { upsert: true },
    );

    const primaryRole = roles.find((role) => PRIMARY_ROLE_CODES.has(role.code));
    if (primaryRole) {
      targetUser.role = primaryRole.code as
        | 'superadmin'
        | 'teacher'
        | 'student';
      await targetUser.save();
    }

    return this.appService.envelope(true, 'success');
  }

  async getRoleList(query: RoleListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query?.status) filter.status = query.status;
    if (query?.isSystem !== undefined)
      filter.isSystem = String(query.isSystem) === 'true';
    if (query?.search) {
      const keyword = String(query.search).trim();
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { code: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
      ];
    }
    if (query?.code) {
      filter.code = { $regex: String(query.code).trim(), $options: 'i' };
    }

    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 10);
    const normalizedSortField = query?.sortField || query?.sort;
    const sortField = ALLOWED_ROLE_SORT_FIELDS.has(normalizedSortField || '')
      ? normalizedSortField!
      : 'createdAt';
    const sortOrder = (query?.sortOrder || query?.order) === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.roleModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.roleModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toRolePayload(item)),
        total,
        page,
        limit,
      },
      'success',
    );
  }

  async getRoleById(id: string) {
    const role = await this.roleModel.findById(id).lean();
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.appService.envelope(this.toRolePayload(role), 'success');
  }

  async getRoleWithMenus(id: string) {
    const role = await this.roleModel.findById(id).lean();
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const menus = await this.menuModel
      .find({ _id: { $in: role.menuIds || [] } })
      .sort({ sort: 1, createdAt: 1 })
      .lean();

    return this.appService.envelope(
      {
        ...this.toRolePayload(role),
        menus: menus.map((menu) => this.toMenuPayload(menu)),
      },
      'success',
    );
  }

  async createRole(body: CreateRoleDto, currentUser: AuthenticatedUser) {
    if (!body?.name || !body?.code) {
      throw new BadRequestException('Role name and code are required');
    }

    const existing = await this.roleModel.findOne({
      $or: [{ code: body.code }, { name: body.name }],
    });
    if (existing) {
      throw new BadRequestException('Role already exists');
    }

    const menuIds = await this.ensureMenusExist(body.menuIds || []);
    const created = await this.roleModel.create({
      _id: `r-${Date.now()}`,
      name: body.name,
      code: body.code,
      description: body.description || '',
      status: body.status || 'active',
      remark: body.remark,
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
      menuIds,
      isSystem: false,
      createdBy: currentUser.id,
    });

    return this.appService.envelope(this.toRolePayload(created), 'success');
  }

  async updateRole(id: string, body: UpdateRoleDto) {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (body?.name || body?.code) {
      const existing = await this.roleModel.findOne({
        _id: { $ne: id },
        $or: [{ code: body.code }, { name: body.name }],
      });
      if (existing) {
        throw new BadRequestException('Role already exists');
      }
    }

    if (body.name !== undefined) role.name = body.name;
    if (body.code !== undefined) role.code = body.code;
    if (body.description !== undefined) role.description = body.description;
    if (body.status !== undefined) role.status = body.status;
    if (body.remark !== undefined) role.remark = body.remark;
    if (body.permissions !== undefined) {
      role.permissions = Array.isArray(body.permissions)
        ? body.permissions
        : [];
    }
    if (body.menuIds !== undefined) {
      role.menuIds = await this.ensureMenusExist(body.menuIds);
    }

    await role.save();
    return this.appService.envelope(this.toRolePayload(role), 'success');
  }

  async deleteRole(id: string) {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystem) {
      throw new BadRequestException('System role cannot be deleted');
    }

    await this.roleModel.deleteOne({ _id: id });
    await this.userRoleModel.updateMany({}, { $pull: { roleIds: id } });

    return this.appService.envelope({ success: true, id }, 'success');
  }

  async assignMenusToRole(id: string, menuIds: string[]) {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    role.menuIds = await this.ensureMenusExist(menuIds || []);
    await role.save();

    return this.appService.envelope(this.toRolePayload(role), 'success');
  }

  async getMenuList(query: MenuListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query?.status) filter.status = query.status;
    if (query?.type) filter.type = query.type;
    if (query?.hidden !== undefined)
      filter.hidden = String(query.hidden) === 'true';
    if (query?.name)
      filter.name = { $regex: String(query.name), $options: 'i' };
    if (query?.path)
      filter.path = { $regex: String(query.path), $options: 'i' };

    const normalizedSortField = query?.sortField || query?.sort;
    const sortField = [
      'sort',
      'createdAt',
      'updatedAt',
      'name',
      'path',
      'code',
    ].includes(normalizedSortField || '')
      ? normalizedSortField!
      : 'sort';
    const sortOrder = (query?.sortOrder || query?.order) === 'desc' ? -1 : 1;

    const menus = await this.menuModel
      .find(filter)
      .sort({ [sortField]: sortOrder, createdAt: 1 })
      .lean();
    const payload = menus.map((menu) => this.toMenuPayload(menu));
    return this.appService.envelope(
      query?.tree ? this.buildMenuTree(payload) : payload,
      'success',
    );
  }

  async getMenuById(id: string) {
    const menu = await this.menuModel.findById(id).lean();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.appService.envelope(this.toMenuPayload(menu), 'success');
  }

  async createMenu(body: CreateMenuDto, currentUser: AuthenticatedUser) {
    if (!body?.name || !body?.code || !body?.path) {
      throw new BadRequestException('Menu name, code, and path are required');
    }

    const existing = await this.menuModel.findOne({
      $or: [{ code: body.code }, { path: body.path }],
    });
    if (existing) {
      throw new BadRequestException('Menu already exists');
    }

    if (body.parentId) {
      const parent = await this.menuModel.findById(body.parentId);
      if (!parent) {
        throw new BadRequestException('Parent menu does not exist');
      }
    }

    const created = await this.menuModel.create({
      _id: `m-${Date.now()}`,
      name: body.name,
      code: body.code,
      path: body.path,
      component: body.component,
      redirect: body.redirect,
      type: body.type || 'menu',
      parentId: body.parentId ?? null,
      icon: body.icon,
      sort: Number(body.sort ?? 0),
      hidden: !!body.hidden,
      status: body.status || 'active',
      meta: body.meta || {},
      isSystem: false,
      createdBy: currentUser.id,
    });

    return this.appService.envelope(this.toMenuPayload(created), 'success');
  }

  async updateMenu(id: string, body: UpdateMenuDto) {
    const menu = await this.menuModel.findById(id);
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    if (body.code || body.path) {
      const existing = await this.menuModel.findOne({
        _id: { $ne: id },
        $or: [{ code: body.code }, { path: body.path }],
      });
      if (existing) {
        throw new BadRequestException('Menu already exists');
      }
    }

    if (body.parentId) {
      if (body.parentId === id) {
        throw new BadRequestException('Menu cannot be its own parent');
      }

      const parent = await this.menuModel.findById(body.parentId);
      if (!parent) {
        throw new BadRequestException('Parent menu does not exist');
      }
    }

    if (body.name !== undefined) menu.name = body.name;
    if (body.code !== undefined) menu.code = body.code;
    if (body.path !== undefined) menu.path = body.path;
    if (body.component !== undefined) menu.component = body.component;
    if (body.redirect !== undefined) menu.redirect = body.redirect;
    if (body.type !== undefined) menu.type = body.type;
    if (body.parentId !== undefined) menu.parentId = body.parentId;
    if (body.icon !== undefined) menu.icon = body.icon;
    if (body.sort !== undefined) menu.sort = Number(body.sort);
    if (body.hidden !== undefined) menu.hidden = !!body.hidden;
    if (body.status !== undefined) menu.status = body.status;
    if (body.meta !== undefined) menu.meta = body.meta;

    await menu.save();
    return this.appService.envelope(this.toMenuPayload(menu), 'success');
  }

  async deleteMenu(id: string) {
    const menu = await this.menuModel.findById(id);
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    if (menu.isSystem) {
      throw new BadRequestException('System menu cannot be deleted');
    }

    const hasChildren = await this.menuModel.exists({ parentId: id });
    if (hasChildren) {
      throw new BadRequestException('Delete child menus first');
    }

    await this.menuModel.deleteOne({ _id: id });
    await this.roleModel.updateMany({}, { $pull: { menuIds: id } });

    return this.appService.envelope({ success: true, id }, 'success');
  }

  private async getTargetUser(
    currentUser: AuthenticatedUser,
    requestedUserId: string,
  ) {
    const targetUserId =
      requestedUserId === 'current' ? currentUser.id : requestedUserId;
    if (
      requestedUserId !== 'current' &&
      currentUser.id !== targetUserId &&
      currentUser.role !== 'superadmin'
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const user = await this.userModel.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async getAssignedRoles(userId: string, fallbackRoleCode: string) {
    const assignment = await this.userRoleModel.findOne({ userId }).lean();
    const roleIds = assignment?.roleIds?.length
      ? assignment.roleIds
      : await this.findFallbackRoleIds(fallbackRoleCode);
    const roles = await this.roleModel.find({ _id: { $in: roleIds } }).lean();

    if (roles.length) {
      return roles.sort(
        (left, right) => roleIds.indexOf(left._id) - roleIds.indexOf(right._id),
      );
    }

    return [];
  }

  private async findFallbackRoleIds(fallbackRoleCode: string) {
    const fallbackRole = await this.roleModel
      .findOne({ code: fallbackRoleCode })
      .lean();
    return fallbackRole ? [fallbackRole._id] : [];
  }

  private async getMenusForRoles(
    roles: Array<RoleDocument | (Role & { _id: string })>,
  ) {
    const menuIds = [...new Set(roles.flatMap((role) => role.menuIds || []))];
    if (!menuIds.length) {
      return [];
    }

    const menus = await this.menuModel
      .find({ _id: { $in: menuIds }, status: 'active' })
      .sort({ sort: 1, createdAt: 1 })
      .lean();

    return this.buildMenuTree(menus.map((menu) => this.toMenuPayload(menu)));
  }

  private async ensureMenusExist(menuIds: string[]) {
    const normalizedMenuIds = [...new Set((menuIds || []).filter(Boolean))];
    if (!normalizedMenuIds.length) {
      return [];
    }

    const existingMenus = await this.menuModel
      .find({ _id: { $in: normalizedMenuIds } })
      .lean();
    if (existingMenus.length !== normalizedMenuIds.length) {
      throw new BadRequestException('One or more menus do not exist');
    }

    return normalizedMenuIds;
  }

  private toRolePayload(role: RoleDocument | (Role & { _id: string })) {
    return {
      _id: role._id,
      id: role._id,
      name: role.name,
      code: role.code,
      description: role.description,
      menuIds: role.menuIds || [],
      permissions: role.permissions || [],
      isSystem: !!role.isSystem,
      status: role.status,
      remark: role.remark,
      createdBy: role.createdBy,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private toMenuPayload(
    menu: MenuDocument | (Menu & { _id: string }),
  ): MenuPayload {
    return {
      _id: menu._id,
      name: menu.name,
      code: menu.code,
      path: menu.path,
      component: menu.component,
      redirect: menu.redirect,
      type: menu.type,
      parentId: menu.parentId ?? null,
      icon: menu.icon,
      sort: menu.sort,
      hidden: !!menu.hidden,
      status: menu.status,
      meta: menu.meta || {},
      createdBy: menu.createdBy,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      isSystem: !!menu.isSystem,
    };
  }

  private buildMenuTree(items: MenuPayload[]) {
    const nodeMap = new Map<string, MenuTreeNode>();
    const roots: MenuTreeNode[] = [];

    items.forEach((item) => {
      nodeMap.set(item._id, { ...item, children: [] });
    });

    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parentNode = nodeMap.get(node.parentId);
        if (parentNode?.children) {
          parentNode.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: MenuTreeNode[]) => {
      nodes.sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0));
      nodes.forEach((node) => {
        if (!node.children?.length) {
          delete node.children;
          return;
        }

        sortNodes(node.children);
      });
    };

    sortNodes(roots);
    return roots;
  }
}
