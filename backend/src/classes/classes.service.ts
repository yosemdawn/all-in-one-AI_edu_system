import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import { TokenService } from '../auth/auth.helpers';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AddStudentsDto } from './dto/add-students.dto';
import { ClassListQueryDto } from './dto/class-list-query.dto';
import { ClassStudentsQueryDto } from './dto/class-students-query.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { ClassMembership, ClassMembershipDocument } from './schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from './schemas/class.schema';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly tokenService: TokenService,
    private readonly appService: AppService,
  ) {}

  async getClasses(
    authorization: string | undefined,
    query: ClassListQueryDto,
  ) {
    const filter: Record<string, unknown> = {};
    const currentUser = authorization
      ? await this.getUserFromAuthorization(authorization)
      : null;

    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }
    if (currentUser?.role === 'teacher') {
      filter.teacherId = currentUser.id;
    }
    if (currentUser?.role === 'student') {
      const joinedClassIds = await this.membershipModel.distinct('classId', {
        studentId: currentUser.id,
        status: 'active',
      });
      filter._id = { $in: joinedClassIds };
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.classModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.classModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toClassListItem(item)),
        total,
        page,
        limit,
      },
      '获取成功',
    );
  }

  async getClass(id: string) {
    const classItem = await this.classModel.findById(id).lean();
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }

    return this.appService.envelope(this.toClassListItem(classItem), '获取成功');
  }

  async createClass(authorization: string | undefined, payload: CreateClassDto) {
    const user = await this.getUserFromAuthorization(authorization);
    this.assertTeacherPrivileges(user);

    const code = payload.code || `C${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await this.classModel.exists({ code });
    if (exists) {
      throw new BadRequestException('班级邀请码已存在');
    }

    const classItem = await this.classModel.create({
      name: payload.name,
      code,
      teacherId: user.id,
      teacherName: user.name,
      status: 'active',
      studentCount: 0,
      maxStudents: payload.maxStudents || 60,
      description: payload.description || '',
    });

    return this.appService.envelope(
      { message: '创建成功', classId: classItem.id },
      '创建成功',
    );
  }

  async updateClass(
    authorization: string | undefined,
    id: string,
    payload: UpdateClassDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }
    this.assertCanManageClass(user, classItem.teacherId);

    if (payload.name !== undefined) classItem.name = payload.name;
    if (payload.description !== undefined) classItem.description = payload.description;
    if (payload.maxStudents !== undefined) {
      if (payload.maxStudents < classItem.studentCount) {
        throw new BadRequestException('班级人数上限不能小于当前人数');
      }
      classItem.maxStudents = payload.maxStudents;
    }
    if (payload.status && ['active', 'inactive', 'disbanded'].includes(payload.status)) {
      classItem.status = payload.status as 'active' | 'inactive' | 'disbanded';
    }

    await classItem.save();
    return this.appService.envelope({ message: '更新成功' }, '更新成功');
  }

  async closeClass(authorization: string | undefined, id: string) {
    const user = await this.getUserFromAuthorization(authorization);
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }
    this.assertCanManageClass(user, classItem.teacherId);

    classItem.status = 'disbanded';
    await classItem.save();
    return this.appService.envelope({ message: '班级已解散' }, '解散成功');
  }

  async regenerateCode(authorization: string | undefined, id: string) {
    const user = await this.getUserFromAuthorization(authorization);
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }
    this.assertCanManageClass(user, classItem.teacherId);

    classItem.code = `N${Math.floor(1000 + Math.random() * 9000)}`;
    await classItem.save();

    return this.appService.envelope(
      { message: '邀请码已刷新', inviteCode: classItem.code },
      '刷新成功',
    );
  }

  async getClassStudents(id: string, query: ClassStudentsQueryDto) {
    const classItem = await this.classModel.findById(id).lean();
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }

    const filter: Record<string, unknown> = { classId: id };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.studentName = { $regex: query.search, $options: 'i' };
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.membershipModel.find(filter).sort({ joinedAt: -1 }).skip(skip).limit(limit).lean(),
      this.membershipModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => ({
          _id: item._id?.toString(),
          classId: item.classId,
          studentId: item.studentId,
          studentName: item.studentName,
          studentNumber: item.studentNumber,
          status: item.status,
          joinMethod: item.joinMethod,
          joinedAt: item.joinedAt,
          totalSubmissions: item.totalSubmissions,
          lastSubmissionTime: item.lastSubmissionTime,
        })),
        total,
        page,
        limit,
      },
      '获取成功',
    );
  }

  async addStudents(
    authorization: string | undefined,
    id: string,
    body: AddStudentsDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }
    this.assertCanManageClass(user, classItem.teacherId);

    const success: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const studentId of body.studentIds || []) {
      if (classItem.studentCount + success.length >= classItem.maxStudents) {
        failed.push({ id: studentId, reason: '班级人数已满' });
        continue;
      }

      const student = await this.userModel.findById(studentId);
      if (!student || student.role !== 'student') {
        failed.push({ id: studentId, reason: '学生不存在' });
        continue;
      }

      const exists = await this.membershipModel.exists({ classId: id, studentId: student.id });
      if (exists) {
        failed.push({ id: studentId, reason: '学生已在班级中' });
        continue;
      }

      await this.membershipModel.create({
        classId: id,
        studentId: student.id,
        studentName: student.name,
        studentNumber: student.studentId,
        status: 'active',
        joinMethod: 'teacher',
        joinedAt: new Date(),
        totalSubmissions: 0,
        lastSubmissionTime: null,
      });

      student.classId = id;
      student.className = classItem.name;
      await student.save();
      success.push(student.id);
    }

    if (success.length > 0) {
      classItem.studentCount += success.length;
      await classItem.save();
    }

    return this.appService.envelope({ success, failed }, '添加成功');
  }

  async joinClass(authorization: string | undefined, body: JoinClassDto) {
    const user = await this.getUserFromAuthorization(authorization);
    if (user.role !== 'student') {
      throw new ForbiddenException('只有学生可以加入班级');
    }

    const classItem = await this.classModel.findOne({ code: body.code });
    if (!classItem) {
      throw new NotFoundException('班级邀请码不存在');
    }

    const exists = await this.membershipModel.exists({
      classId: classItem.id,
      studentId: user.id,
    });
    if (exists) {
      return this.appService.envelope({ success: true, message: '加入成功' }, '加入成功');
    }

    if (classItem.status !== 'active') {
      throw new BadRequestException('当前班级不可加入');
    }
    if ((classItem.studentCount || 0) >= (classItem.maxStudents || 60)) {
      throw new BadRequestException('班级人数已满');
    }

    await this.membershipModel.create({
      classId: classItem.id,
      studentId: user.id,
      studentName: user.name,
      studentNumber: user.studentId,
      status: 'active',
      joinMethod: 'code',
      joinedAt: new Date(),
      totalSubmissions: 0,
      lastSubmissionTime: null,
    });

    classItem.studentCount += 1;
    await classItem.save();

    user.classId = classItem.id;
    user.className = classItem.name;
    await user.save();

    return this.appService.envelope({ success: true, message: '加入成功' }, '加入成功');
  }

  async updateStudentStatus(
    authorization: string | undefined,
    id: string,
    body: UpdateStudentStatusDto,
  ) {
    const user = await this.getUserFromAuthorization(authorization);
    const classItem = await this.classModel.findById(id).lean();
    if (!classItem) {
      throw new NotFoundException('班级不存在');
    }
    this.assertCanManageClass(user, classItem.teacherId);

    await this.membershipModel.updateMany(
      {
        classId: id,
        studentId: { $in: body.studentIds || [] },
      },
      {
        $set: { status: body.status },
      },
    );

    return this.appService.envelope({ success: true }, '更新成功');
  }

  async leaveClass(authorization: string | undefined, id: string) {
    const user = await this.getUserFromAuthorization(authorization);
    if (user.role !== 'student') {
      throw new ForbiddenException('只有学生可以退出班级');
    }

    const deleted = await this.membershipModel.findOneAndDelete({
      classId: id,
      studentId: user.id,
    });

    if (deleted) {
      await this.classModel.findByIdAndUpdate(id, { $inc: { studentCount: -1 } });

      const remainingMembership = await this.membershipModel
        .findOne({ studentId: user.id, status: 'active' })
        .sort({ joinedAt: -1 })
        .lean();

      if (remainingMembership) {
        const remainingClass = await this.classModel.findById(remainingMembership.classId).lean();
        user.classId = remainingMembership.classId;
        user.className = remainingClass?.name;
      } else {
        user.classId = undefined;
        user.className = undefined;
      }

      await user.save();
    }

    return this.appService.envelope({ success: true, message: '已退出班级' }, '退出成功');
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

  private assertTeacherPrivileges(user: UserDocument) {
    if (!['teacher', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('当前用户无权执行教师端操作');
    }
  }

  private assertCanManageClass(user: UserDocument, teacherId: string) {
    this.assertTeacherPrivileges(user);
    if (user.role !== 'superadmin' && user.id !== teacherId) {
      throw new ForbiddenException('只能管理自己的班级');
    }
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

  private toClassListItem(item: any) {
    return {
      _id: item._id?.toString?.() || item.id,
      name: item.name,
      code: item.code,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      status: item.status,
      studentCount: item.studentCount,
      maxStudents: item.maxStudents,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
