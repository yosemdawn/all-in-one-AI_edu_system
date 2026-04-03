import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection, Model } from 'mongoose';
import { Assignment, AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { ClassMembership, ClassMembershipDocument } from '../classes/schemas/class-membership.schema';
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
    if (isTestEnv) {
      await this.connection.dropDatabase();
    } else {
      const existingUsers = await this.userModel.countDocuments();
      if (existingUsers > 0) {
        return;
      }
    }

    const passwordHash = await bcrypt.hash('123456', 10);

    const [admin, teacher, student] = await this.userModel.create([
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

    const classItem = await this.classModel.create({
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
        name: 'Default Review Rule',
        modelType: 'doubao',
        prompt: 'Provide a score and short improvement advice.',
        originalRuleId: 'rule-1',
        snapshotAt: new Date().toISOString(),
      },
      questionMaterial: {
        content: '<p>Answer the five reading comprehension questions.</p>',
      },
      referenceAnswer: {
        content: '<p>1.A 2.C 3.B 4.D 5.A</p>',
      },
      gradingNotes: 'Score each question and explain mistakes briefly.',
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
