import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
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
    const existingUsers = await this.userModel.countDocuments();
    if (existingUsers > 0) {
      return;
    }

    const passwordHash = await bcrypt.hash('123456', 10);

    const [admin, teacher, student] = await this.userModel.create([
      {
        username: 'admin',
        email: 'admin@nengdou.local',
        name: '管理员',
        role: 'superadmin',
        status: 'active',
        passwordHash,
      },
      {
        username: 'teacher1',
        email: 'teacher@nengdou.local',
        name: '王老师',
        role: 'teacher',
        status: 'active',
        passwordHash,
      },
      {
        username: 'student1',
        email: 'student@nengdou.local',
        studentId: '20250001',
        name: '张同学',
        role: 'student',
        status: 'active',
        passwordHash,
      },
    ]);

    const classItem = await this.classModel.create({
      name: '高一(1)班',
      code: 'A1001',
      teacherId: teacher.id,
      teacherName: teacher.name,
      status: 'active',
      studentCount: 1,
      maxStudents: 60,
      description: '英语写作提升班',
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
      title: '英语阅读理解训练 1',
      description: '<p>请完成阅读理解并提交答案。</p>',
      teacherId: teacher.id,
      teacherName: teacher.name,
      classes: [{ id: classItem.id, name: classItem.name }],
      aiRule: {
        id: 'rule-1',
        name: '标准答题批改模板',
        modelType: 'doubao',
        prompt: '请根据题目、标准答案和学生答案进行评分，并给出问题与建议。',
        originalRuleId: 'rule-1',
        snapshotAt: new Date().toISOString(),
      },
      questionMaterial: {
        content: '<p>题目原文：请根据文章回答 5 个问题。</p>',
      },
      referenceAnswer: {
        content: '<p>标准答案：1.A 2.C 3.B 4.D 5.A</p>',
      },
      gradingNotes: '按题号逐项给分，错题说明原因。',
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
