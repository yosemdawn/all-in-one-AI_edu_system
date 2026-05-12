import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthContextService } from '../auth/auth-context.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { PasswordService } from '../auth/auth.helpers';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import {
  Submission,
  SubmissionDocument,
} from '../submissions/schemas/submission.schema';
import { AdminUpdateUserPasswordDto } from './dto/admin-update-user-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUserRowDto } from './dto/import-user-row.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { User, UserDocument } from './schemas/user.schema';
import { encryptAiApiKey, maskAiApiKey } from './ai-api-key.crypto';

type AllowedRole = 'superadmin' | 'teacher' | 'student';
const ALLOWED_USER_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'username',
  'email',
  'name',
  'role',
  'status',
  'studentId',
]);

type UserPayloadSource = {
  _id?: { toString(): string };
  id?: string;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  studentId?: string;
  phone?: string;
  avatar?: string;
  meta?: Record<string, unknown>;
  classId?: string;
  className?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
};

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
    private readonly authContextService: AuthContextService,
    private readonly passwordService: PasswordService,
  ) {}

  async getUsers(query: UserListQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query?.role) {
      filter.role = query.role;
    }
    if (query?.status) {
      filter.status = query.status;
    }
    const keyword = query?.keyword || query?.search;
    if (keyword) {
      const normalizedKeyword = String(keyword).trim();
      filter.$or = [
        { username: { $regex: normalizedKeyword, $options: 'i' } },
        { email: { $regex: normalizedKeyword, $options: 'i' } },
        { name: { $regex: normalizedKeyword, $options: 'i' } },
        { studentId: { $regex: normalizedKeyword, $options: 'i' } },
        { phone: { $regex: normalizedKeyword, $options: 'i' } },
      ];
    }

    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 10);
    const skip = (page - 1) * limit;
    const normalizedSortField = query?.sortField || query?.sort;
    const sortField = ALLOWED_USER_SORT_FIELDS.has(normalizedSortField || '')
      ? normalizedSortField!
      : 'createdAt';
    const sortOrder = (query?.sortOrder || query?.order) === 'asc' ? 1 : -1;

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
      throw new NotFoundException('User not found');
    }

    return this.toUserPayload(user);
  }

  async getCurrentUserProfile(currentUser: AuthenticatedUser) {
    const user = await this.getCurrentUserDocument(currentUser);
    return this.toUserPayload(user, true);
  }

  async updateCurrentUserProfile(
    currentUser: AuthenticatedUser,
    body: UpdateUserProfileDto,
  ) {
    const user = await this.getCurrentUserDocument(currentUser);

    if (body.email) {
      const duplicated = await this.userModel.exists({
        _id: { $ne: user._id },
        email: body.email,
      });
      if (duplicated) {
        throw new BadRequestException('Email already exists');
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

  async updateCurrentUserPassword(
    currentUser: AuthenticatedUser,
    body: UpdateUserPasswordDto,
  ) {
    const user = await this.getCurrentUserDocument(currentUser);
    const { currentPassword, newPassword } = body;

    if (!currentPassword) {
      throw new BadRequestException('Current password is required');
    }

    const passwordMatched = await this.comparePassword(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (!newPassword || String(newPassword).length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters',
      );
    }

    user.passwordHash = await this.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.lastLogoutAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return { success: true };
  }

  async getCurrentUserAiSettings(currentUser: AuthenticatedUser) {
    const user = await this.getCurrentUserDocument(currentUser);
    return this.toAiSettingsPayload(user);
  }

  async updateCurrentUserAiSettings(
    currentUser: AuthenticatedUser,
    body: UpdateAiSettingsDto,
  ) {
    const user = await this.getCurrentUserDocument(currentUser);
    const apiKey = body.apiKey?.trim();
    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    const updatedAt = new Date();
    user.aiSettings = {
      ...(user.aiSettings || {}),
      doubaoApiKeyEncrypted: encryptAiApiKey(apiKey),
      doubaoApiKeyPreview: maskAiApiKey(apiKey),
      doubaoApiKeyUpdatedAt: updatedAt,
    };
    await user.save();

    return this.toAiSettingsPayload(user);
  }

  async clearCurrentUserAiSettings(currentUser: AuthenticatedUser) {
    const user = await this.getCurrentUserDocument(currentUser);
    user.aiSettings = {
      ...(user.aiSettings || {}),
      doubaoApiKeyEncrypted: null,
      doubaoApiKeyPreview: '',
      doubaoApiKeyUpdatedAt: null,
    };
    await user.save();

    return this.toAiSettingsPayload(user);
  }

  async createUser(body: CreateUserDto) {
    if (!body.username || !body.email || !body.password || !body.name) {
      throw new BadRequestException(
        'username, email, name, and password are required',
      );
    }

    const normalizedRole = (body.role || 'student') as AllowedRole;
    await this.assertUniqueUserFields({
      username: body.username,
      email: body.email,
      studentId: normalizedRole === 'student' ? body.studentId : undefined,
    });

    const passwordHash = await this.hashPassword(body.password);
    const user = await this.userModel.create({
      username: body.username,
      email: body.email,
      name: body.name,
      role: normalizedRole,
      status: body.status || 'active',
      studentId:
        normalizedRole === 'student'
          ? body.studentId ||
            `${Math.floor(10000000 + Math.random() * 90000000)}`
          : undefined,
      phone: body.phone,
      avatar: body.avatar,
      meta: body.meta,
      passwordHash,
      mustChangePassword: true,
    });

    return this.getUser(user.id);
  }

  async updateUser(id: string, body: UpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const nextRole = (body.role || user.role) as AllowedRole;
    await this.assertUniqueUserFields(
      {
        username: body.username,
        email: body.email,
        studentId:
          nextRole === 'student'
            ? (body.studentId ?? user.studentId)
            : undefined,
      },
      id,
    );

    if (body.username !== undefined) user.username = body.username;
    if (body.email !== undefined) user.email = body.email;
    if (body.name !== undefined) user.name = body.name;
    if (body.role !== undefined) user.role = nextRole;
    if (body.status !== undefined) user.status = body.status;
    user.studentId =
      nextRole === 'student' ? (body.studentId ?? user.studentId) : undefined;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.avatar !== undefined) user.avatar = body.avatar;
    if (body.meta !== undefined) user.meta = body.meta;

    await user.save();
    return this.getUser(id);
  }

  async updateUserPassword(id: string, body: AdminUpdateUserPasswordDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { newPassword } = body;
    if (!newPassword || String(newPassword).length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters',
      );
    }

    user.passwordHash = await this.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.lastLogoutAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return { success: true, message: 'password updated' };
  }

  async resetUserPassword(id: string, body?: ResetUserPasswordDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newPassword = body?.newPassword || '123456';
    if (String(newPassword).length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters',
      );
    }

    user.passwordHash = await this.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = true;
    user.lastLogoutAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return { success: true, message: 'password reset', id, newPassword };
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'superadmin') {
      throw new BadRequestException('Cannot delete superadmin');
    }

    const memberships = await this.membershipModel
      .find({ studentId: user.id })
      .lean();

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

  async importUsers(items: ImportUserRowDto[]) {
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
          item.email?.trim() ||
          `${username.toLowerCase()}_${Date.now()}@import.local`;

        await this.createUser({
          username,
          email,
          password: item.password || '123456',
          name: item.name || username,
          role: item.role || 'student',
          studentId: item.studentId,
          phone: item.phone,
          status: item.status || 'active',
        });
        successCount += 1;
      } catch (error: unknown) {
        failures.push({
          index,
          reason: this.getErrorMessage(error, 'import failed'),
        });
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

  async deleteUsers(body: { userIds?: string[] }) {
    const userIds = Array.isArray(body?.userIds) ? body.userIds : [];
    const failures: Array<{ userId: string; reason: string }> = [];
    let successCount = 0;

    for (const userId of userIds) {
      try {
        await this.deleteUser(userId);
        successCount += 1;
      } catch (error: unknown) {
        failures.push({
          userId,
          reason: this.getErrorMessage(error, 'delete failed'),
        });
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

  private async getCurrentUserDocument(currentUser: AuthenticatedUser) {
    return this.authContextService.requireUser(currentUser.id);
  }

  private async hashPassword(password: string): Promise<string> {
    const hashedPassword = await this.passwordService.hash(password);
    return hashedPassword;
  }

  private async comparePassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const isMatched = await this.passwordService.compare(
      password,
      passwordHash,
    );
    return isMatched;
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
        throw new BadRequestException('Username already exists');
      }
    }

    if (payload.email) {
      const existing = await this.userModel.exists({
        _id: { $ne: excludeId },
        email: payload.email,
      });
      if (existing) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (payload.studentId) {
      const existing = await this.userModel.exists({
        _id: { $ne: excludeId },
        studentId: payload.studentId,
      });
      if (existing) {
        throw new BadRequestException('Student ID already exists');
      }
    }
  }

  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private toUserPayload(user: UserPayloadSource, includeAuthDates = false) {
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

  private toAiSettingsPayload(user: UserDocument) {
    return {
      provider: 'doubao',
      configured: !!user.aiSettings?.doubaoApiKeyEncrypted,
      apiKeyPreview: user.aiSettings?.doubaoApiKeyPreview || '',
      updatedAt: user.aiSettings?.doubaoApiKeyUpdatedAt || null,
    };
  }
}
