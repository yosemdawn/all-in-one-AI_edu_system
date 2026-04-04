import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from '../app.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
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
    private readonly appService: AppService,
  ) {}

  async getClasses(
    currentUser: AuthenticatedUser,
    query: ClassListQueryDto,
  ) {
    const filter = this.buildClassFilter(query);

    if (currentUser.role === 'teacher') {
      filter.teacherId = currentUser.id;
    } else if (currentUser.role === 'student') {
      const joinedClassIds = await this.membershipModel.distinct('classId', {
        studentId: currentUser.id,
        status: 'active',
      });
      filter._id = { $in: joinedClassIds };
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;
    const sort = this.resolveClassSort(query);

    const [items, total] = await Promise.all([
      this.classModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.classModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toClassListItem(item)),
        total,
        page,
        limit,
      },
      'success',
    );
  }

  async getPublicClasses(query: ClassListQueryDto) {
    const filter = this.buildClassFilter({
      ...query,
      status: query.status || 'active',
    });
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 100);
    const skip = (page - 1) * limit;
    const sort = this.resolveClassSort(query);

    const [items, total] = await Promise.all([
      this.classModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.classModel.countDocuments(filter),
    ]);

    return this.appService.envelope(
      {
        items: items.map((item) => this.toPublicClassListItem(item)),
        total,
        page,
        limit,
      },
      'success',
    );
  }

  async getClass(id: string) {
    const classItem = await this.classModel.findById(id).lean();
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    return this.appService.envelope(this.toClassListItem(classItem), 'success');
  }

  async createClass(currentUser: AuthenticatedUser, payload: CreateClassDto) {
    this.assertTeacherPrivileges(currentUser);

    const code = payload.code || `C${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await this.classModel.exists({ code });
    if (exists) {
      throw new BadRequestException('Class code already exists');
    }

    const classItem = await this.classModel.create({
      name: payload.name,
      code,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      status: 'active',
      studentCount: 0,
      maxStudents: payload.maxStudents || 60,
      description: payload.description || '',
    });

    return this.appService.envelope(
      { message: 'created', classId: classItem.id },
      'success',
    );
  }

  async updateClass(
    currentUser: AuthenticatedUser,
    id: string,
    payload: UpdateClassDto,
  ) {
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }
    this.assertCanManageClass(currentUser, classItem.teacherId);

    if (payload.name !== undefined) classItem.name = payload.name;
    if (payload.description !== undefined) classItem.description = payload.description;
    if (payload.maxStudents !== undefined) {
      if (payload.maxStudents < classItem.studentCount) {
        throw new BadRequestException('maxStudents cannot be lower than current student count');
      }
      classItem.maxStudents = payload.maxStudents;
    }
    if (payload.status && ['active', 'inactive', 'disbanded'].includes(payload.status)) {
      classItem.status = payload.status as 'active' | 'inactive' | 'disbanded';
    }

    await classItem.save();
    return this.appService.envelope({ message: 'updated' }, 'success');
  }

  async closeClass(currentUser: AuthenticatedUser, id: string) {
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }
    this.assertCanManageClass(currentUser, classItem.teacherId);

    classItem.status = 'disbanded';
    await classItem.save();
    return this.appService.envelope({ message: 'closed' }, 'success');
  }

  async regenerateCode(currentUser: AuthenticatedUser, id: string) {
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }
    this.assertCanManageClass(currentUser, classItem.teacherId);

    classItem.code = `N${Math.floor(1000 + Math.random() * 9000)}`;
    await classItem.save();

    return this.appService.envelope(
      { message: 'refreshed', inviteCode: classItem.code },
      'success',
    );
  }

  async getClassStudents(id: string, query: ClassStudentsQueryDto) {
    const classItem = await this.classModel.findById(id).lean();
    if (!classItem) {
      throw new NotFoundException('Class not found');
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
      'success',
    );
  }

  async addStudents(
    currentUser: AuthenticatedUser,
    id: string,
    body: AddStudentsDto,
  ) {
    const classItem = await this.classModel.findById(id);
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }
    this.assertCanManageClass(currentUser, classItem.teacherId);

    const success: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const studentId of body.studentIds || []) {
      if (classItem.studentCount + success.length >= classItem.maxStudents) {
        failed.push({ id: studentId, reason: 'Class is full' });
        continue;
      }

      const student = await this.userModel.findById(studentId);
      if (!student || student.role !== 'student') {
        failed.push({ id: studentId, reason: 'Student not found' });
        continue;
      }

      const exists = await this.membershipModel.exists({ classId: id, studentId: student.id });
      if (exists) {
        failed.push({ id: studentId, reason: 'Student already joined' });
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

    return this.appService.envelope({ success, failed }, 'success');
  }

  async joinClass(currentUser: AuthenticatedUser, body: JoinClassDto) {
    if (currentUser.role !== 'student') {
      throw new ForbiddenException('Only students can join classes');
    }

    const classItem = await this.classModel.findOne({ code: body.code });
    if (!classItem) {
      throw new NotFoundException('Invite code is invalid');
    }

    const user = await this.userModel.findById(currentUser.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const exists = await this.membershipModel.exists({
      classId: classItem.id,
      studentId: user.id,
    });
    if (exists) {
      return this.appService.envelope({ success: true, message: 'joined' }, 'success');
    }

    if (classItem.status !== 'active') {
      throw new BadRequestException('Class is not available');
    }
    if ((classItem.studentCount || 0) >= (classItem.maxStudents || 60)) {
      throw new BadRequestException('Class is full');
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

    return this.appService.envelope({ success: true, message: 'joined' }, 'success');
  }

  async updateStudentStatus(
    currentUser: AuthenticatedUser,
    id: string,
    body: UpdateStudentStatusDto,
  ) {
    const classItem = await this.classModel.findById(id).lean();
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }
    this.assertCanManageClass(currentUser, classItem.teacherId);

    await this.membershipModel.updateMany(
      {
        classId: id,
        studentId: { $in: body.studentIds || [] },
      },
      {
        $set: { status: body.status },
      },
    );

    return this.appService.envelope({ success: true }, 'success');
  }

  async leaveClass(currentUser: AuthenticatedUser, id: string) {
    if (currentUser.role !== 'student') {
      throw new ForbiddenException('Only students can leave classes');
    }

    const user = await this.userModel.findById(currentUser.id);
    if (!user) {
      throw new NotFoundException('User not found');
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

    return this.appService.envelope({ success: true, message: 'left' }, 'success');
  }

  private assertTeacherPrivileges(user: AuthenticatedUser) {
    if (!['teacher', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('Teacher privileges required');
    }
  }

  private assertCanManageClass(user: AuthenticatedUser, teacherId: string) {
    this.assertTeacherPrivileges(user);
    if (user.role !== 'superadmin' && user.id !== teacherId) {
      throw new ForbiddenException('You can only manage your own classes');
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

  private toPublicClassListItem(item: any) {
    return {
      _id: item._id?.toString?.() || item.id,
      name: item.name,
      teacherName: item.teacherName,
      status: item.status,
      studentCount: item.studentCount,
      maxStudents: item.maxStudents,
    };
  }

  private buildClassFilter(query: ClassListQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }
    if (query.teacherId) {
      filter.teacherId = query.teacherId;
    }

    return filter;
  }

  private resolveClassSort(query: ClassListQueryDto) {
    const sortField = query.sortField || query.sort || 'createdAt';
    const sortOrder = query.sortOrder || query.order || 'desc';

    return {
      [sortField]: sortOrder === 'asc' ? 1 : -1,
      _id: -1,
    } as Record<string, 1 | -1>;
  }
}
