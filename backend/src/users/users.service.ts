import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordService, TokenService } from '../auth/auth.helpers';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { Submission, SubmissionDocument } from '../submissions/schemas/submission.schema';
import { User, UserDocument } from './schemas/user.schema';

type AllowedRole = 'superadmin' | 'teacher' | 'student';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
  ) {}

  async getUsers(query: any) {
    const filter: Record<string, unknown> = {};

    if (query?.role) {
      filter.role = query.role;
    }
    if (query?.status) {
      filter.status = query.status;
    }
    if (query?.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { username: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
        { studentId: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } },
      ];
    }

    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 10);
    const skip = (page - 1) * limit;
    const sortField = query?.sortField || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toUserPayload(item)),
      total,
      page,
      limit,
    };
  }

  async getUser(id: string) {
    const user = await this.userModel.findById(id).lean();
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.toUserPayload(user);
  }

  async getCurrentUserProfile(authorization?: string) {
    const user = await this.getUserFromAuthorization(authorization);
    return this.toUserPayload(user, true);
  }

  async updateCurrentUserProfile(authorization: string | undefined, body: any) {
    const user = await this.getUserFromAuthorization(authorization);

    if (body.email) {
      const duplicated = await this.userModel.exists({
        _id: { $ne: user._id },
        email: body.email,
      });
      if (duplicated) {
        throw new BadRequestException('邮箱已存在');
      }
    }

    user.email = body.email ?? user.email;
    user.name = body.name ?? user.name;
    user.phone = body.phone ?? user.phone;
    user.avatar = body.avatar ?? user.avatar;
    user.meta = body.meta ?? user.meta;
    await user.save();

    return this.toUserPayload(user, true);
  }

  async updateCurrentUserPassword(authorization: string | undefined, body: any) {
    const user = await this.getUserFromAuthorization(authorization);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;

    if (!currentPassword) {
      throw new BadRequestException('当前密码不能为空');
    }

    const passwordMatched = await this.passwordService.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new BadRequestException('当前密码错误');
    }

    if (!newPassword || String(newPassword).length < 6) {
      throw new BadRequestException('新密码长度不能少于 6 位');
    }

    user.passwordHash = await this.passwordService.hash(newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.lastLogoutAt = new Date();
    await user.save();

    return { success: true };
  }

  async createUser(body: any) {
    if (!body.username || !body.email || !body.password || !body.name) {
      throw new BadRequestException('用户名、姓名、邮箱和密码不能为空');
    }

    const normalizedRole = (body.role || 'student') as AllowedRole;
    await this.assertUniqueUserFields({
      username: body.username,
      email: body.email,
      studentId: normalizedRole === 'student' ? body.studentId : undefined,
    });

    const passwordHash = await this.passwordService.hash(body.password);
    const user = await this.userModel.create({
      username: body.username,
      email: body.email,
      name: body.name,
      role: normalizedRole,
      status: body.status || 'active',
      studentId:
        normalizedRole === 'student'
          ? body.studentId || `${Math.floor(10000000 + Math.random() * 90000000)}`
          : undefined,
      phone: body.phone,
      avatar: body.avatar,
      meta: body.meta,
      passwordHash,
      mustChangePassword: true,
    });

    return this.getUser(user.id);
  }

  async updateUser(id: string, body: any) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const nextRole = (body.role || user.role) as AllowedRole;
    await this.assertUniqueUserFields(
      {
        username: body.username,
        email: body.email,
        studentId:
          nextRole === 'student' ? body.studentId ?? user.studentId : undefined,
      },
      id,
    );

    if (body.username !== undefined) user.username = body.username;
    if (body.email !== undefined) user.email = body.email;
    if (body.name !== undefined) user.name = body.name;
    if (body.role !== undefined) user.role = nextRole;
    if (body.status !== undefined) user.status = body.status;
    user.studentId =
      nextRole === 'student' ? body.studentId ?? user.studentId : undefined;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.avatar !== undefined) user.avatar = body.avatar;
    if (body.meta !== undefined) user.meta = body.meta;

    await user.save();
    return this.getUser(id);
  }

  async updateUserPassword(id: string, body: any) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const newPassword = body?.newPassword;
    if (!newPassword || String(newPassword).length < 6) {
      throw new BadRequestException('新密码长度不能少于 6 位');
    }

    user.passwordHash = await this.passwordService.hash(newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.lastLogoutAt = new Date();
    await user.save();

    return { success: true, message: '修改成功' };
  }

  async resetUserPassword(id: string, body?: any) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const newPassword = body?.newPassword || '123456';
    if (String(newPassword).length < 6) {
      throw new BadRequestException('新密码长度不能少于 6 位');
    }

    user.passwordHash = await this.passwordService.hash(newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = true;
    user.lastLogoutAt = new Date();
    await user.save();

    return { success: true, message: '重置成功', id, newPassword };
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.role === 'superadmin') {
      throw new BadRequestException('超级管理员不能删除');
    }

    const memberships = await this.membershipModel.find({ studentId: user.id }).lean();

    if (memberships.length > 0) {
      const classIds = memberships.map((item) => item.classId);
      await this.classModel.updateMany(
        { _id: { $in: classIds } },
        { $inc: { studentCount: -1 } },
      );
      await this.membershipModel.deleteMany({ studentId: user.id });
      await this.submissionModel.deleteMany({ studentId: user.id });
    }

    await this.userModel.findByIdAndDelete(id);
    return { success: true, id };
  }

  async importUsers(items: any[]) {
    const rows = Array.isArray(items) ? items : [];
    const failures: Array<{ index: number; reason: string }> = [];
    let successCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const item = rows[index];
      try {
        const username =
          item.username?.trim() ||
          item.name?.trim() ||
          `user${Date.now()}${index}`;
        const email =
          item.email?.trim() || `${username.toLowerCase()}_${Date.now()}@import.local`;

        await this.createUser({
          username,
          email,
          password: item.password || '123456',
          name: item.name,
          role: item.role || 'student',
          studentId: item.studentId,
          phone: item.phone,
          status: item.status || 'active',
        });
        successCount += 1;
      } catch (error: any) {
        failures.push({ index, reason: error?.message || '导入失败' });
      }
    }

    return {
      success: failures.length === 0,
      total: rows.length,
      successCount,
      failureCount: failures.length,
      failures,
    };
  }

  async deleteUsers(body: any) {
    const userIds = Array.isArray(body?.userIds) ? body.userIds : [];
    const failures: Array<{ userId: string; reason: string }> = [];
    let successCount = 0;

    for (const userId of userIds) {
      try {
        await this.deleteUser(userId);
        successCount += 1;
      } catch (error: any) {
        failures.push({ userId, reason: error?.message || '删除失败' });
      }
    }

    return {
      success: failures.length === 0,
      total: userIds.length,
      successCount,
      failureCount: failures.length,
      failures,
    };
  }

  private async assertUniqueUserFields(
    payload: { username?: string; email?: string; studentId?: string },
    excludeId?: string,
  ) {
    if (payload.username) {
      const existing = await this.userModel.exists({
        _id: { $ne: excludeId },
        username: payload.username,
      });
      if (existing) {
        throw new BadRequestException('用户名已存在');
      }
    }

    if (payload.email) {
      const existing = await this.userModel.exists({
        _id: { $ne: excludeId },
        email: payload.email,
      });
      if (existing) {
        throw new BadRequestException('邮箱已存在');
      }
    }

    if (payload.studentId) {
      const existing = await this.userModel.exists({
        _id: { $ne: excludeId },
        studentId: payload.studentId,
      });
      if (existing) {
        throw new BadRequestException('学号已存在');
      }
    }
  }

  private async getUserFromAuthorization(authorization?: string) {
    const token = authorization?.replace('Bearer ', '').trim();
    if (!token) {
      throw new UnauthorizedException('未登录');
    }

    const decoded = this.tokenService.verifyAccessToken(token);
    const user = await this.userModel.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('登录失效');
    }

    this.assertTokenFreshForUser(user, decoded.iat);
    return user;
  }

  private assertTokenFreshForUser(user: UserDocument, issuedAt?: number) {
    const issuedAtDate = issuedAt ? new Date(issuedAt * 1000) : null;
    if (
      issuedAtDate &&
      user.lastLogoutAt &&
      user.lastLogoutAt.getTime() > issuedAtDate.getTime()
    ) {
      throw new UnauthorizedException('登录已失效');
    }
    if (
      issuedAtDate &&
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() > issuedAtDate.getTime()
    ) {
      throw new UnauthorizedException('登录已失效');
    }
  }

  private toUserPayload(user: any, includeAuthDates = false) {
    return {
      _id: user._id?.toString?.() || user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status === 'locked' ? 'inactive' : user.status,
      studentId: user.studentId,
      phone: user.phone,
      avatar: user.avatar,
      meta: user.meta,
      classId: user.classId,
      className: user.className,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: includeAuthDates ? user.lastLoginAt : undefined,
    };
  }
}
