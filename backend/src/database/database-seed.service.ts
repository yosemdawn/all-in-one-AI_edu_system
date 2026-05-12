import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { hash as bcryptHash } from 'bcrypt';
import { Connection, Model } from 'mongoose';
import {
  Assignment,
  AssignmentDocument,
} from '../assignments/schemas/assignment.schema';
import {
  ClassMembership,
  ClassMembershipDocument,
} from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(ClassMembership.name)
    private readonly membershipModel: Model<ClassMembershipDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedIfNeeded();
  }

  private async seedIfNeeded() {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isProductionEnv = process.env.NODE_ENV === 'production';
    const demoSeedEnabled = process.env.ENABLE_DEMO_SEED === 'true';

    if (isTestEnv) {
      await this.connection.dropDatabase();
    } else if (isProductionEnv && !demoSeedEnabled) {
      this.logger.log('Skipping demo seed in production environment');
      return;
    }

    const existingUsers = await this.userModel.countDocuments();
    if (!isTestEnv && existingUsers > 0) {
      this.logger.log(
        'Skipping demo seed because the target database already contains users',
      );
      return;
    }

    const passwordHash = await bcryptHash('123456', 10);

    const createdUsers: UserDocument[] = await this.userModel.create([
      {
        username: 'admin',
        email: 'admin@nengdou.local',
        name: 'Admin',
        role: 'superadmin',
        status: 'active',
        passwordHash,
      },
      {
        username: 'teacher1',
        email: 'teacher@nengdou.local',
        name: 'Teacher One',
        role: 'teacher',
        status: 'active',
        passwordHash,
      },
      {
        username: 'student1',
        email: 'student@nengdou.local',
        studentId: '20250001',
        name: 'Student One',
        role: 'student',
        status: 'active',
        passwordHash,
      },
    ]);
    const [admin, teacher, student] = createdUsers;

    const classItem: ClassDocument = await this.classModel.create({
      name: 'Demo Class 1',
      code: 'A1001',
      teacherId: teacher.id,
      teacherName: teacher.name,
      status: 'active',
      studentCount: 1,
      maxStudents: 60,
      description: 'Seeded demo class',
    });

    await this.membershipModel.create({
      classId: classItem.id,
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.studentId,
      status: 'active',
      joinMethod: 'code',
      joinedAt: new Date(),
      totalSubmissions: 0,
      lastSubmissionTime: null,
    });

    student.classId = classItem.id;
    student.className = classItem.name;
    await student.save();

    await this.assignmentModel.create({
      title: 'Seed Assignment 1',
      description: '<p>Please complete the seeded assignment.</p>',
      teacherId: teacher.id,
      teacherName: teacher.name,
      classes: [{ id: classItem.id, name: classItem.name }],
      aiRule: {
        id: 'rule-1',
        name: '默认中文批改规则',
        modelType: 'doubao',
        prompt:
          '请根据作业要求、参考答案和学生提交内容进行批改。请给出 0-100 分的分数，并用简体中文提供简洁、具体、可执行的改进建议。',
        originalRuleId: 'rule-1',
        snapshotAt: new Date().toISOString(),
      },
      questionMaterial: {
        content: '<p>Answer the five reading comprehension questions.</p>',
      },
      referenceAnswer: {
        content: '<p>1.A 2.C 3.B 4.D 5.A</p>',
      },
      gradingNotes: '请逐题给分，并用中文简要说明错误原因和改进建议。',
      submissionFormat: 'answers_only',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      allowAttachments: true,
      status: 'published',
    });

    this.logger.log(
      `Seeded demo data for users ${admin.id}, ${teacher.id}, ${student.id} and class ${classItem.id}`,
    );
  }
}
