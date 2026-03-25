import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type RoleCode = 'superadmin' | 'teacher' | 'student';
type AssignmentStatus = 'draft' | 'published' | 'terminated';
type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'ai_reviewed'
  | 'teacher_reviewed';

type User = {
  id: string;
  username: string;
  email: string;
  studentId?: string;
  name: string;
  role: RoleCode;
  status: 'active' | 'inactive' | 'locked';
  password: string;
  mustChangePassword?: boolean;
  classId?: string;
  className?: string;
  createdAt: string;
  updatedAt: string;
};

type ClassItem = {
  _id: string;
  name: string;
  code: string;
  teacherId: string;
  teacherName: string;
  status: 'active' | 'inactive' | 'disbanded';
  studentCount: number;
  maxStudents: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

type AiRule = {
  id: string;
  name: string;
  description?: string;
  modelType: string;
  prompt: string;
  visibility: 'private' | 'public' | 'system';
  status: 'active' | 'inactive';
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Assignment = {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  classes: Array<{ id: string; name: string }>;
  aiRule?: any;
  questionMaterial?: any;
  referenceAnswer?: any;
  gradingNotes?: string;
  submissionFormat?: 'answer_sheet' | 'answers_only' | 'mixed';
  startDate: string;
  endDate: string;
  allowAttachments?: boolean;
  status: AssignmentStatus;
  terminatedReason?: string;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
};

type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentNumber?: string;
  classId: string;
  className: string;
  content: string;
  attachments: any[];
  status: SubmissionStatus;
  isDraft: boolean;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  submissionCount: number;
  aiScore?: number;
  aiReviewContent?: string;
  aiReviewMetadata?: any;
  aiReviewedAt?: string;
  teacherScore?: number;
  teacherReviewContent?: string;
  teacherReviewedAt?: string;
};

@Injectable()
export class AppService {
  private tokenCounter = 1;
  private refreshCounter = 1;
  private readonly tokens = new Map<string, string>();
  private readonly refreshTokens = new Map<string, string>();

  private readonly users: User[] = [];
  private readonly classes: ClassItem[] = [];
  private readonly classMembers: any[] = [];
  private readonly aiRules: AiRule[] = [];
  private readonly assignments: Assignment[] = [];
  private readonly submissions: Submission[] = [];
  private readonly aiModels: any[] = [];
  private readonly logs: any[] = [];

  constructor() {
    this.seed();
  }

  private now() {
    return new Date().toISOString();
  }

  private seed() {
    const now = this.now();

    this.users.push(
      {
        id: 'u-admin',
        username: 'admin',
        email: 'admin@nengdou.local',
        name: '管理员',
        role: 'superadmin',
        status: 'active',
        password: '123456',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u-teacher',
        username: 'teacher1',
        email: 'teacher@nengdou.local',
        name: '王老师',
        role: 'teacher',
        status: 'active',
        password: '123456',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u-student',
        username: 'student1',
        email: 'student@nengdou.local',
        studentId: '20250001',
        name: '张同学',
        role: 'student',
        status: 'active',
        password: '123456',
        classId: 'c-1',
        className: '高一(1)班',
        createdAt: now,
        updatedAt: now,
      },
    );

    this.classes.push({
      _id: 'c-1',
      name: '高一(1)班',
      code: 'A1001',
      teacherId: 'u-teacher',
      teacherName: '王老师',
      status: 'active',
      studentCount: 1,
      maxStudents: 60,
      description: '英语写作提升班',
      createdAt: now,
      updatedAt: now,
    });

    this.classMembers.push({
      _id: 'cm-1',
      classId: 'c-1',
      studentId: 'u-student',
      studentName: '张同学',
      studentNumber: '20250001',
      status: 'active',
      joinMethod: 'code',
      joinedAt: now,
      totalSubmissions: 0,
      lastSubmissionTime: null,
    });

    this.aiRules.push({
      id: 'rule-1',
      name: '标准答题批改模板',
      description: '适用于答题卡、标准答案对照批改',
      modelType: 'doubao',
      prompt: '请根据题目、标准答案和学生答案进行评分，返回总分、问题、建议。',
      visibility: 'system',
      status: 'active',
      tags: ['答题卡', '标准答案'],
      createdAt: now,
      updatedAt: now,
    });

    this.assignments.push({
      id: 'a-1',
      title: '英语阅读理解训练 1',
      description: '<p>请完成阅读理解并提交答案。</p>',
      teacherId: 'u-teacher',
      teacherName: '王老师',
      classes: [{ id: 'c-1', name: '高一(1)班' }],
      aiRule: {
        id: 'rule-1',
        name: '标准答题批改模板',
        modelType: 'doubao',
        prompt: '请根据题目、标准答案和学生答案进行评分，返回总分、问题、建议。',
        originalRuleId: 'rule-1',
        snapshotAt: now,
      },
      questionMaterial: {
        content: '<p>题目原文：请根据文章回答 5 个问题。</p>',
      },
      referenceAnswer: {
        content: '<p>标准答案：1.A 2.C 3.B 4.D 5.A</p>',
      },
      gradingNotes: '按题号逐项给分，错题说明原因。',
      submissionFormat: 'answers_only',
      startDate: now,
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      allowAttachments: true,
      status: 'published',
      isExpired: false,
      createdAt: now,
      updatedAt: now,
    });

    this.aiModels.push({
      code: 'doubao',
      name: '豆包',
      provider: 'ByteDance',
      modelName: 'doubao-lite',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: 'demo-key',
      status: 'active',
      isDefault: true,
      totalUsage: 12,
      totalTokens: 3200,
      lastBalance: 100,
      balanceCurrency: 'CNY',
      lastBalanceCheck: now,
    });

    this.logs.push({
      id: 'log-1',
      username: 'admin',
      method: 'POST',
      path: '/v1/auth/login',
      statusCode: 200,
      createdAt: now,
    });
  }

  envelope<T>(data: T, message = 'success') {
    return { code: 200, message, data };
  }

  getHello() {
    return this.envelope({ name: 'nengdou-backend', ok: true }, 'backend ready');
  }

  private issueTokens(userId: string) {
    const token = `token-${this.tokenCounter++}`;
    const refreshToken = `refresh-${this.refreshCounter++}`;
    this.tokens.set(token, userId);
    this.refreshTokens.set(refreshToken, userId);
    return { token, refreshToken, expiresIn: 60 * 60 * 24 };
  }

  private getUserByToken(auth?: string) {
    const token = auth?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('未登录');
    const userId = this.tokens.get(token);
    const user = this.users.find((item) => item.id === userId);
    if (!user) throw new UnauthorizedException('登录失效');
    return user;
  }

  login(body: any) {
    const user = this.users.find(
      (item) =>
        (item.email === body.usernameOrEmailOrStudentId ||
          item.studentId === body.usernameOrEmailOrStudentId ||
          item.username === body.usernameOrEmailOrStudentId) &&
        item.password === body.password,
    );
    if (!user) throw new UnauthorizedException('账号或密码错误');
    const tokens = this.issueTokens(user.id);
    return this.envelope(
      {
        ...tokens,
        mustChangePassword: !!user.mustChangePassword,
        isFirstLogin: false,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: !!user.mustChangePassword,
          classId: user.classId,
          className: user.className,
          status: user.status,
        },
      },
      '登录成功',
    );
  }

  logout() {
    return this.envelope({ success: true }, '退出成功');
  }

  refresh(body: any) {
    const userId = this.refreshTokens.get(body.refreshToken);
    if (!userId) throw new UnauthorizedException('refresh token 无效');
    return this.envelope(this.issueTokens(userId), '刷新成功');
  }

  profile(auth?: string) {
    const user = this.getUserByToken(auth);
    return this.envelope(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          mustChangePassword: !!user.mustChangePassword,
          classId: user.classId,
          className: user.className,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      '获取成功',
    );
  }

  register(body: any) {
    const classItem = body.classId
      ? this.classes.find((item) => item._id === body.classId)
      : undefined;
    const user: User = {
      id: `u-${Date.now()}`,
      username: body.username,
      email: body.email,
      studentId: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: body.name || body.username,
      role: 'student',
      status: 'active',
      password: body.password,
      classId: classItem?._id,
      className: classItem?.name,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.users.push(user);
    if (classItem) {
      this.classMembers.push({
        _id: `cm-${Date.now()}`,
        classId: classItem._id,
        studentId: user.id,
        studentName: user.name,
        studentNumber: user.studentId,
        status: 'active',
        joinMethod: 'register',
        joinedAt: this.now(),
        totalSubmissions: 0,
        lastSubmissionTime: null,
      });
      classItem.studentCount += 1;
    }
    const tokens = this.issueTokens(user.id);
    return this.envelope(
      { ...tokens, success: true, message: '注册成功', userId: user.id },
      '注册成功',
    );
  }

  changePassword() {
    return this.envelope({ message: '修改成功' }, '修改成功');
  }

  getMenusByRole(role: RoleCode) {
    if (role === 'teacher') {
      return [
        {
          _id: 'm-td',
          name: '教学中心',
          path: '/teacher/dashboard',
          type: 'menu',
          icon: 'House',
          meta: { title: '教学中心' },
        },
        {
          _id: 'm-tc',
          name: '班级管理',
          path: '/teacher/classes',
          type: 'menu',
          icon: 'Reading',
          meta: { title: '班级管理' },
        },
        {
          _id: 'm-ta',
          name: '作业管理',
          path: '/teacher/assignments',
          type: 'menu',
          icon: 'EditPen',
          meta: { title: '作业管理' },
        },
        {
          _id: 'm-tr',
          name: '评分规则模板',
          path: '/teacher/ai-rules',
          type: 'menu',
          icon: 'Setting',
          meta: { title: '评分规则模板' },
        },
      ];
    }
    if (role === 'student') {
      return [
        {
          _id: 'm-sd',
          name: '学习中心',
          path: '/student/dashboard',
          type: 'menu',
          icon: 'House',
          meta: { title: '学习中心' },
        },
        {
          _id: 'm-sc',
          name: '我的班级',
          path: '/student/classes',
          type: 'menu',
          icon: 'Reading',
          meta: { title: '我的班级' },
        },
        {
          _id: 'm-sa',
          name: '我的作业',
          path: '/student/assignments',
          type: 'menu',
          icon: 'EditPen',
          meta: { title: '我的作业' },
        },
      ];
    }
    return [
      {
        _id: 'm-ad',
        name: '系统控制台',
        path: '/admin/dashboard',
        type: 'menu',
        icon: 'Setting',
        meta: { title: '系统控制台' },
      },
      {
        _id: 'm-au',
        name: '用户管理',
        path: '/system/users',
        type: 'menu',
        icon: 'User',
        meta: { title: '用户管理' },
      },
      {
        _id: 'm-am',
        name: '菜单管理',
        path: '/system/menus',
        type: 'menu',
        icon: 'Menu',
        meta: { title: '菜单管理' },
      },
      {
        _id: 'm-ar',
        name: '角色管理',
        path: '/system/roles',
        type: 'menu',
        icon: 'Avatar',
        meta: { title: '角色管理' },
      },
      {
        _id: 'm-ai',
        name: '模型管理',
        path: '/system/ai_model',
        type: 'menu',
        icon: 'Cpu',
        meta: { title: '模型管理' },
      },
    ];
  }

  getResources(auth?: string) {
    const user = this.getUserByToken(auth);
    const roles = [
      {
        _id: `${user.role}-role`,
        id: `${user.role}-role`,
        name: user.role,
        code: user.role,
      },
    ];
    const permissions =
      user.role === 'teacher'
        ? ['class:view', 'assignment:create', 'submission:review']
        : user.role === 'student'
          ? ['assignment:view', 'submission:create']
          : ['system:manage'];
    const menus = this.getMenusByRole(user.role);
    return this.envelope({ roles, permissions, menus }, '获取成功');
  }

  getRoleList() {
    return this.envelope(
      {
        items: [
          {
            _id: 'r-admin',
            name: '超级管理员',
            code: 'superadmin',
            description: '系统管理员',
            status: 'active',
            isSystem: true,
            permissions: ['system:manage'],
            menuIds: [],
          },
          {
            _id: 'r-teacher',
            name: '教师',
            code: 'teacher',
            description: '教师角色',
            status: 'active',
            isSystem: true,
            permissions: ['assignment:create'],
            menuIds: [],
          },
          {
            _id: 'r-student',
            name: '学生',
            code: 'student',
            description: '学生角色',
            status: 'active',
            isSystem: true,
            permissions: ['submission:create'],
            menuIds: [],
          },
        ],
        total: 3,
        page: 1,
        limit: 10,
      },
      '获取成功',
    );
  }

  getMenuList() {
    return this.envelope([...this.getMenusByRole('superadmin')], '获取成功');
  }

  getClasses(params?: any) {
    let items = [...this.classes];
    if (params?.status) items = items.filter((item) => item.status === params.status);
    if (params?.search)
      items = items.filter((item) => item.name.includes(params.search));
    return this.envelope(
      {
        items,
        total: items.length,
        page: Number(params?.page || 1),
        limit: Number(params?.limit || items.length || 10),
      },
      '获取成功',
    );
  }

  getClass(id: string) {
    const item = this.classes.find((cls) => cls._id === id);
    if (!item) throw new NotFoundException('班级不存在');
    return this.envelope(item, '获取成功');
  }

  createClass(auth: string | undefined, payload: any) {
    const user = this.getUserByToken(auth);
    const item: ClassItem = {
      _id: `c-${Date.now()}`,
      name: payload.name,
      code: payload.code || `C${Math.floor(1000 + Math.random() * 9000)}`,
      teacherId: user.id,
      teacherName: user.name,
      status: 'active',
      studentCount: 0,
      maxStudents: payload.maxStudents || 60,
      description: payload.description || '',
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.classes.push(item);
    return this.envelope({ message: '创建成功', classId: item._id }, '创建成功');
  }

  updateClass(id: string, payload: any) {
    const item = this.classes.find((cls) => cls._id === id);
    if (!item) throw new NotFoundException('班级不存在');
    Object.assign(item, payload, { updatedAt: this.now() });
    return this.envelope({ message: '更新成功' }, '更新成功');
  }

  closeClass(id: string) {
    const item = this.classes.find((cls) => cls._id === id);
    if (!item) throw new NotFoundException('班级不存在');
    item.status = 'disbanded';
    item.updatedAt = this.now();
    return this.envelope({ message: '班级已解散' }, '解散成功');
  }

  regenerateCode(id: string) {
    const item = this.classes.find((cls) => cls._id === id);
    if (!item) throw new NotFoundException('班级不存在');
    item.code = `N${Math.floor(1000 + Math.random() * 9000)}`;
    item.updatedAt = this.now();
    return this.envelope(
      { message: '邀请码已刷新', inviteCode: item.code },
      '刷新成功',
    );
  }

  getClassStudents(id: string, params?: any) {
    let items = this.classMembers.filter((m) => m.classId === id);
    if (params?.search)
      items = items.filter((m) => m.studentName.includes(params.search));
    if (params?.status) items = items.filter((m) => m.status === params.status);
    return this.envelope(
      {
        items,
        total: items.length,
        page: Number(params?.page || 1),
        limit: Number(params?.limit || 20),
      },
      '获取成功',
    );
  }

  addStudents(id: string, data: any) {
    const classItem = this.classes.find((item) => item._id === id);
    if (!classItem) throw new NotFoundException('班级不存在');
    const success: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const studentId of data.studentIds || []) {
      const user = this.users.find((u) => u.id === studentId && u.role === 'student');
      if (!user) {
        failed.push({ id: studentId, reason: '学生不存在' });
        continue;
      }
      this.classMembers.push({
        _id: `cm-${Date.now()}-${studentId}`,
        classId: id,
        studentId: user.id,
        studentName: user.name,
        studentNumber: user.studentId,
        status: 'active',
        joinMethod: 'teacher',
        joinedAt: this.now(),
        totalSubmissions: 0,
        lastSubmissionTime: null,
      });
      user.classId = id;
      user.className = classItem.name;
      classItem.studentCount += 1;
      success.push(studentId);
    }
    return this.envelope({ success, failed }, '添加成功');
  }

  joinClass(auth: string | undefined, code: string) {
    const user = this.getUserByToken(auth);
    const classItem = this.classes.find((item) => item.code === code);
    if (!classItem) throw new NotFoundException('班级邀请码不存在');
    user.classId = classItem._id;
    user.className = classItem.name;
    this.classMembers.push({
      _id: `cm-${Date.now()}`,
      classId: classItem._id,
      studentId: user.id,
      studentName: user.name,
      studentNumber: user.studentId,
      status: 'active',
      joinMethod: 'code',
      joinedAt: this.now(),
      totalSubmissions: 0,
      lastSubmissionTime: null,
    });
    classItem.studentCount += 1;
    return this.envelope({ success: true, message: '加入成功' }, '加入成功');
  }

  updateStudentStatus(classId: string, data: any) {
    this.classMembers.forEach((item) => {
      if (item.classId === classId && (data.studentIds || []).includes(item.studentId)) {
        item.status = data.status;
      }
    });
    return this.envelope({ success: true }, '更新成功');
  }

  leaveClass(auth: string | undefined, classId: string) {
    const user = this.getUserByToken(auth);
    const index = this.classMembers.findIndex(
      (item) => item.classId === classId && item.studentId === user.id,
    );
    if (index >= 0) this.classMembers.splice(index, 1);
    return this.envelope({ success: true, message: '已退出班级' }, '退出成功');
  }

  listAssignments(params?: any) {
    let items = [...this.assignments];
    if (params?.search)
      items = items.filter((item) => item.title.includes(params.search));
    if (params?.status)
      items = items.filter((item) => item.status === params.status);
    return this.envelope(
      {
        items: items.map((item) => ({
          ...item,
          submissionCount: this.submissions.filter(
            (s) => s.assignmentId === item.id && !s.isDraft,
          ).length,
          totalStudents: this.classMembers.filter((m) =>
            item.classes.some((c) => c.id === m.classId),
          ).length,
          totalSubmissions: this.submissions.filter((s) => s.assignmentId === item.id)
            .length,
          gradedSubmissions: this.submissions.filter(
            (s) =>
              s.assignmentId === item.id &&
              ['ai_reviewed', 'teacher_reviewed'].includes(s.status),
          ).length,
          pendingSubmissions: this.submissions.filter(
            (s) => s.assignmentId === item.id && s.status === 'submitted',
          ).length,
        })),
        total: items.length,
        page: Number(params?.page || 1),
        pageSize: Number(params?.pageSize || 10),
      },
      '获取成功',
    );
  }

  getAssignment(id: string) {
    const item = this.assignments.find((assignment) => assignment.id === id);
    if (!item) throw new NotFoundException('作业不存在');
    return this.envelope(
      {
        ...item,
        totalStudents: this.classMembers.filter((m) =>
          item.classes.some((c) => c.id === m.classId),
        ).length,
        submissionStats: {
          totalSubmissions: this.submissions.filter((s) => s.assignmentId === id).length,
          reviewedSubmissions: this.submissions.filter(
            (s) => s.assignmentId === id && s.status === 'teacher_reviewed',
          ).length,
          pendingSubmissions: this.submissions.filter(
            (s) => s.assignmentId === id && ['submitted', 'ai_reviewed'].includes(s.status),
          ).length,
          draftSubmissions: this.submissions.filter(
            (s) => s.assignmentId === id && s.status === 'draft',
          ).length,
        },
      },
      '获取成功',
    );
  }

  getAssignmentStudents(id: string, params?: any) {
    const assignment = this.assignments.find((a) => a.id === id);
    if (!assignment) throw new NotFoundException('作业不存在');
    let items = this.classMembers
      .filter((member) => assignment.classes.some((c) => c.id === member.classId))
      .map((member) => {
        const submission = this.submissions.find(
          (s) => s.assignmentId === id && s.studentId === member.studentId,
        );
        return submission
          ? {
              ...submission,
              _id: submission.id,
            }
          : {
              _id: `virtual-${member.studentId}`,
              studentId: member.studentId,
              studentName: member.studentName,
              studentNumber: member.studentNumber,
              classId: member.classId,
              className:
                this.classes.find((c) => c._id === member.classId)?.name || '',
              status: 'not_submitted',
            };
      });
    if (params?.studentName)
      items = items.filter((item) => item.studentName?.includes(params.studentName));
    return this.envelope(
      {
        items,
        total: items.length,
        page: Number(params?.page || 1),
        limit: Number(params?.limit || 20),
        totalPages: 1,
      },
      '获取成功',
    );
  }

  createAssignment(auth: string | undefined, payload: any) {
    const user = this.getUserByToken(auth);
    const classes = (payload.classes || []).map((id: string) => {
      const classItem = this.classes.find((item) => item._id === id);
      if (!classItem) throw new NotFoundException('班级不存在');
      return { id: classItem._id, name: classItem.name };
    });
    const item: Assignment = {
      id: `a-${Date.now()}`,
      title: payload.title,
      description: payload.description,
      teacherId: user.id,
      teacherName: user.name,
      classes,
      aiRule: payload.aiRule,
      questionMaterial: payload.questionMaterial,
      referenceAnswer: payload.referenceAnswer,
      gradingNotes: payload.gradingNotes,
      submissionFormat: payload.submissionFormat,
      startDate: payload.startDate,
      endDate: payload.endDate,
      allowAttachments: !!payload.allowAttachments,
      status: payload.status || 'draft',
      isExpired: false,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.assignments.push(item);
    return this.envelope(item, '创建成功');
  }

  updateAssignment(id: string, payload: any) {
    const item = this.assignments.find((assignment) => assignment.id === id);
    if (!item) throw new NotFoundException('作业不存在');
    Object.assign(item, payload, { updatedAt: this.now() });
    return this.envelope(item, '更新成功');
  }

  updateAssignmentStatus(id: string, payload: any) {
    const item = this.assignments.find((assignment) => assignment.id === id);
    if (!item) throw new NotFoundException('作业不存在');
    Object.assign(item, payload, { updatedAt: this.now() });
    return this.envelope(item, '更新成功');
  }

  deleteAssignment(id: string) {
    const index = this.assignments.findIndex((item) => item.id === id);
    if (index >= 0) this.assignments.splice(index, 1);
    return this.envelope(null, '删除成功');
  }

  getStudentAssignments(auth?: string) {
    const user = this.getUserByToken(auth);
    const items = this.assignments
      .filter((item) => item.classes.some((cls) => cls.id === user.classId))
      .map((item) => {
        const submission = this.submissions.find(
          (s) => s.assignmentId === item.id && s.studentId === user.id,
        );
        return {
          ...item,
          classId: user.classId,
          className: user.className,
          hasSubmitted: !!submission && !submission.isDraft,
          hasDraft: !!submission && submission.isDraft,
          submissionStatus: submission?.status,
          submissionId: submission?.id,
          canSubmit: item.status === 'published',
        };
      });
    return this.envelope(items, '获取成功');
  }

  getStudentAssignment(auth: string | undefined, assignmentId: string, classId?: string) {
    const user = this.getUserByToken(auth);
    const assignment = this.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new NotFoundException('作业不存在');
    const submission = this.submissions.find(
      (s) => s.assignmentId === assignmentId && s.studentId === user.id,
    );
    return this.envelope(
      {
        ...assignment,
        classId: classId || user.classId,
        className: user.className,
        hasSubmitted: !!submission && !submission.isDraft,
        hasDraft: !!submission && submission.isDraft,
        submissionStatus: submission?.status,
        submissionId: submission?.id,
        canSubmit: assignment.status === 'published',
      },
      '获取成功',
    );
  }

  getStudentAssignmentStatistics(auth?: string) {
    const user = this.getUserByToken(auth);
    const assignments = this.assignments.filter((item) =>
      item.classes.some((cls) => cls.id === user.classId),
    );
    return this.envelope(
      {
        total: assignments.length,
        pending: assignments.length,
        reviewed: this.submissions.filter(
          (s) =>
            s.studentId === user.id &&
            ['ai_reviewed', 'teacher_reviewed'].includes(s.status),
        ).length,
      },
      '获取成功',
    );
  }

  submit(auth: string | undefined, payload: any) {
    const user = this.getUserByToken(auth);
    const assignment = this.assignments.find((item) => item.id === payload.assignmentId);
    if (!assignment) throw new NotFoundException('作业不存在');
    const className =
      this.classes.find((item) => item._id === payload.classId)?.name ||
      user.className ||
      '';

    const existing = this.submissions.find(
      (item) => item.assignmentId === payload.assignmentId && item.studentId === user.id,
    );

    if (existing) {
      existing.content = payload.content;
      existing.attachments = payload.attachments || [];
      existing.isDraft = !!payload.isDraft;
      existing.status = payload.isDraft ? 'draft' : 'submitted';
      existing.submittedAt = payload.isDraft ? existing.submittedAt : this.now();
      existing.updatedAt = this.now();
      existing.submissionCount = payload.isDraft
        ? existing.submissionCount
        : existing.submissionCount + 1;
      if (!payload.isDraft) this.scheduleAiReview(existing);
      return this.envelope(existing, '提交成功');
    }

    const item: Submission = {
      id: `s-${Date.now()}`,
      assignmentId: payload.assignmentId,
      studentId: user.id,
      studentName: user.name,
      studentNumber: user.studentId,
      classId: payload.classId,
      className,
      content: payload.content,
      attachments: payload.attachments || [],
      status: payload.isDraft ? 'draft' : 'submitted',
      isDraft: !!payload.isDraft,
      submittedAt: payload.isDraft ? null : this.now(),
      updatedAt: this.now(),
      createdAt: this.now(),
      submissionCount: payload.isDraft ? 0 : 1,
    };
    this.submissions.push(item);
    if (!payload.isDraft) this.scheduleAiReview(item);
    return this.envelope(item, '提交成功');
  }

  private scheduleAiReview(submission: Submission) {
    setTimeout(() => {
      submission.status = 'ai_reviewed';
      submission.aiScore = 88;
      submission.aiReviewContent =
        '基于题目、标准答案和评分规则模板，系统判定本次作答整体较好。\n\n优点：答案结构清晰。\n问题：个别题目仍有偏差。\n建议：对照标准答案检查第2题与第4题。';
      submission.aiReviewedAt = this.now();
      submission.aiReviewMetadata = {
        modelUsed: 'doubao-lite',
        processingTime: 1200,
        tokenUsage: { total: 680 },
      };
      const member = this.classMembers.find(
        (item) =>
          item.studentId === submission.studentId && item.classId === submission.classId,
      );
      if (member) {
        member.totalSubmissions = (member.totalSubmissions || 0) + 1;
        member.lastSubmissionTime = this.now();
      }
    }, 2500);
  }

  getMySubmission(auth: string | undefined, assignmentId: string) {
    const user = this.getUserByToken(auth);
    const assignment = this.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new NotFoundException('作业不存在');
    const submission =
      this.submissions.find(
        (item) => item.assignmentId === assignmentId && item.studentId === user.id,
      ) || null;
    return this.envelope(
      {
        assignment: {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.endDate,
          endDate: assignment.endDate,
          maxScore: 100,
          teacherName: assignment.teacherName,
          aiRule: assignment.aiRule,
          questionMaterial: assignment.questionMaterial,
          referenceAnswer: assignment.referenceAnswer,
          gradingNotes: assignment.gradingNotes,
          submissionFormat: assignment.submissionFormat,
          status: assignment.status,
          terminatedReason: assignment.terminatedReason,
        },
        submission,
        aiReview:
          submission && submission.aiScore !== undefined
            ? {
                content: submission.aiReviewContent,
                score: submission.aiScore,
                reviewedAt: submission.aiReviewedAt,
                aiReviewMetadata: submission.aiReviewMetadata,
              }
            : null,
        teacherReview:
          submission && submission.teacherScore !== undefined
            ? {
                content: submission.teacherReviewContent,
                score: submission.teacherScore,
                reviewedAt: submission.teacherReviewedAt,
              }
            : null,
      },
      '获取成功',
    );
  }

  deleteSubmission(body: any) {
    const index = this.submissions.findIndex((item) => item.id === body.submissionId);
    if (index >= 0) this.submissions.splice(index, 1);
    return this.envelope(
      {
        success: true,
        message: '删除成功',
        resourceId: body.submissionId,
      },
      '删除成功',
    );
  }

  getSubmissionList(params?: any) {
    let items = [...this.submissions];
    if (params?.assignmentId)
      items = items.filter((item) => item.assignmentId === params.assignmentId);
    if (params?.classId)
      items = items.filter((item) => item.classId === params.classId);
    if (params?.status)
      items = items.filter((item) => item.status === params.status);
    if (params?.studentName)
      items = items.filter((item) => item.studentName.includes(params.studentName));
    return this.envelope(
      {
        items,
        total: items.length,
        page: Number(params?.page || 1),
        pageSize: Number(params?.limit || 20),
      },
      '获取成功',
    );
  }

  getSubmissionDetail(submissionId: string) {
    const item = this.submissions.find((submission) => submission.id === submissionId);
    if (!item) throw new NotFoundException('提交不存在');
    return this.envelope({ ...item, _id: item.id }, '获取成功');
  }

  teacherReview(body: any) {
    const item = this.submissions.find((submission) => submission.id === body.submissionId);
    if (!item) throw new NotFoundException('提交不存在');
    item.teacherScore = body.teacherScore;
    item.teacherReviewContent = body.teacherReviewContent;
    item.teacherReviewedAt = this.now();
    item.status = 'teacher_reviewed';
    return this.envelope({ success: true, id: item.id }, '批改成功');
  }

  getAiRuleList(params?: any) {
    let items = [...this.aiRules];
    if (params?.search)
      items = items.filter((item) => item.name.includes(params.search));
    if (params?.status)
      items = items.filter((item) => item.status === params.status);
    return this.envelope(
      {
        items,
        total: items.length,
        page: Number(params?.page || 1),
        pageSize: Number(params?.pageSize || 10),
      },
      '获取成功',
    );
  }

  getAiRule(id: string) {
    const item = this.aiRules.find((rule) => rule.id === id);
    if (!item) throw new NotFoundException('规则不存在');
    return this.envelope(item, '获取成功');
  }

  createAiRule(body: any) {
    const item: AiRule = {
      id: `rule-${Date.now()}`,
      createdAt: this.now(),
      updatedAt: this.now(),
      tags: [],
      status: 'active',
      visibility: 'private',
      ...body,
    };
    this.aiRules.push(item);
    return this.envelope({ id: item.id, success: true }, '创建成功');
  }

  updateAiRule(id: string, body: any) {
    const item = this.aiRules.find((rule) => rule.id === id);
    if (!item) throw new NotFoundException('规则不存在');
    Object.assign(item, body, { updatedAt: this.now() });
    return this.envelope({ id, success: true }, '更新成功');
  }

  deleteAiRule(id: string) {
    const index = this.aiRules.findIndex((item) => item.id === id);
    if (index >= 0) this.aiRules.splice(index, 1);
    return this.envelope({ id, success: true }, '删除成功');
  }

  copyAiRule(id: string, body: any) {
    const item = this.aiRules.find((rule) => rule.id === id);
    if (!item) throw new NotFoundException('规则不存在');
    const copy = {
      ...item,
      id: `rule-${Date.now()}`,
      name: body.name || `${item.name}-副本`,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.aiRules.push(copy);
    return this.envelope({ id: copy.id, success: true }, '复制成功');
  }

  getAvailableAiRules(status = 'active') {
    return this.envelope(
      this.aiRules.filter((item) => item.status === status),
      '获取成功',
    );
  }

  getAiModels() {
    return this.envelope(
      {
        models: this.aiModels,
        summary: {
          totalModels: this.aiModels.length,
          activeModels: this.aiModels.filter((item) => item.status === 'active').length,
          totalUsage: this.aiModels.reduce((sum, item) => sum + item.totalUsage, 0),
          totalBalance: this.aiModels.reduce((sum, item) => sum + item.lastBalance, 0),
        },
      },
      '获取成功',
    );
  }

  getAiModel(code: string) {
    const model = this.aiModels.find((item) => item.code === code);
    if (!model) throw new NotFoundException('模型不存在');
    return this.envelope(model, '获取成功');
  }

  updateAiModel(code: string, body: any) {
    const model = this.aiModels.find((item) => item.code === code);
    if (!model) throw new NotFoundException('模型不存在');
    Object.assign(model, body, { updatedAt: this.now() });
    return this.envelope(model, '更新成功');
  }

  setDefaultModel(code: string) {
    this.aiModels.forEach((item) => {
      item.isDefault = item.code === code;
    });
    return this.envelope({ success: true, message: '设置成功' }, '设置成功');
  }

  getModelBalance(code: string) {
    const model = this.aiModels.find((item) => item.code === code);
    if (!model) throw new NotFoundException('模型不存在');
    return this.envelope(
      {
        balance: model.lastBalance,
        currency: model.balanceCurrency,
        lastUpdated: this.now(),
        status: 'success',
      },
      '获取成功',
    );
  }

  testModel(code: string) {
    return this.envelope(
      {
        success: true,
        responseTime: 120,
        message: `${code} 连接正常`,
      },
      '测试成功',
    );
  }

  getModelStats() {
    return this.envelope(
      {
        dailyUsage: [],
        monthlyUsage: [],
        recentActivity: [],
      },
      '获取成功',
    );
  }

  initializeModels() {
    return this.envelope({ success: true, message: '初始化成功' }, '初始化成功');
  }

  getAdminOverview() {
    return this.envelope(
      {
        totalUsers: this.users.length,
        totalClasses: this.classes.length,
        totalAssignments: this.assignments.length,
        totalSubmissions: this.submissions.length,
        aiModelCount: this.aiModels.length,
        userRoleDistribution: [
          {
            role: 'SUPER_ADMIN',
            count: this.users.filter((u) => u.role === 'superadmin').length,
            percentage: 10,
          },
          {
            role: 'TEACHER',
            count: this.users.filter((u) => u.role === 'teacher').length,
            percentage: 20,
          },
          {
            role: 'STUDENT',
            count: this.users.filter((u) => u.role === 'student').length,
            percentage: 70,
          },
        ],
        classStatusDistribution: [
          {
            status: 'active',
            count: this.classes.filter((c) => c.status === 'active').length,
            percentage: 100,
          },
        ],
        submissionStatusDistribution: [
          {
            status: 'submitted',
            count: this.submissions.filter((s) => s.status === 'submitted').length,
            percentage: 0,
          },
          {
            status: 'ai_reviewed',
            count: this.submissions.filter((s) => s.status === 'ai_reviewed').length,
            percentage: 0,
          },
          {
            status: 'teacher_reviewed',
            count: this.submissions.filter((s) => s.status === 'teacher_reviewed').length,
            percentage: 0,
          },
        ],
        lastUpdated: this.now(),
      },
      '获取成功',
    );
  }

  getTeacherDashboard(auth?: string) {
    const user = this.getUserByToken(auth);
    const myClasses = this.classes.filter((c) => c.teacherId === user.id);
    const myAssignments = this.assignments.filter((a) => a.teacherId === user.id);
    const relevantSubmissions = this.submissions.filter((s) =>
      myAssignments.some((a) => a.id === s.assignmentId),
    );
    return this.envelope(
      {
        myClasses: myClasses.length,
        myAssignments: myAssignments.length,
        pendingReviews: relevantSubmissions.filter((s) =>
          ['submitted', 'ai_reviewed'].includes(s.status),
        ).length,
        totalStudents: this.classMembers.filter((m) =>
          myClasses.some((c) => c._id === m.classId),
        ).length,
        classSubmissionStats: myClasses.map((cls) => ({
          classId: cls._id,
          className: cls.name,
          totalStudents: this.classMembers.filter((m) => m.classId === cls._id).length,
          submittedCount: this.submissions.filter(
            (s) => s.classId === cls._id && !s.isDraft,
          ).length,
          submissionRate: 80,
        })),
        assignmentStatusDistribution: [
          {
            status: 'draft',
            count: myAssignments.filter((a) => a.status === 'draft').length,
            percentage: 0,
          },
          {
            status: 'published',
            count: myAssignments.filter((a) => a.status === 'published').length,
            percentage: 0,
          },
          {
            status: 'terminated',
            count: myAssignments.filter((a) => a.status === 'terminated').length,
            percentage: 0,
          },
        ],
        aiReviewStats: {
          todayReviews: relevantSubmissions.filter((s) => s.aiScore !== undefined).length,
          totalReviews: relevantSubmissions.filter((s) => s.aiScore !== undefined).length,
          failedReviews: 0,
          pendingReviews: relevantSubmissions.filter((s) => s.status === 'submitted').length,
        },
        studentScoreAnalysis: {
          avgAiScore: 88,
          avgTeacherScore: 90,
          scoreDifference: 2,
          excellentRate: 66,
          passRate: 100,
        },
      },
      '获取成功',
    );
  }

  getTeacherPendingTasks(auth?: string) {
    const user = this.getUserByToken(auth);
    const myAssignments = this.assignments.filter((a) => a.teacherId === user.id);
    return this.envelope(
      {
        assignments: myAssignments.map((assignment) => ({
          id: assignment.id,
          title: assignment.title,
          classCount: assignment.classes.length,
          submissionRate: 80,
          status: assignment.status,
          endDate: assignment.endDate,
        })),
        submissions: this.submissions
          .filter((submission) =>
            myAssignments.some((assignment) => assignment.id === submission.assignmentId),
          )
          .map((submission) => ({
            id: submission.id,
            assignmentId: submission.assignmentId,
            studentName: submission.studentName,
            assignmentTitle:
              this.assignments.find((a) => a.id === submission.assignmentId)?.title || '',
            status: submission.status,
            submittedAt: submission.submittedAt || submission.createdAt,
            aiScore: submission.aiScore,
          })),
      },
      '获取成功',
    );
  }

  getStudentDashboard(auth?: string) {
    const user = this.getUserByToken(auth);
    const myAssignments = this.assignments
      .filter((item) => item.classes.some((cls) => cls.id === user.classId))
      .map((item) => {
        const submission = this.submissions.find(
          (s) => s.assignmentId === item.id && s.studentId === user.id,
        );
        return {
          ...item,
          classId: user.classId,
          className: user.className,
          hasSubmitted: !!submission && !submission.isDraft,
          hasDraft: !!submission && submission.isDraft,
        };
      });
    const mySubs = this.submissions.filter((s) => s.studentId === user.id);
    return this.envelope(
      {
        completedSubmissions: mySubs.filter((s) => !s.isDraft).length,
        averageScore: mySubs.length
          ? Math.round(
              mySubs.reduce((sum, s) => sum + (s.teacherScore || s.aiScore || 0), 0) /
                mySubs.length,
            )
          : 0,
        joinedClasses: user.classId ? 1 : 0,
        onTimeRate: 100,
        pendingAssignments: myAssignments.filter((a) => !a.hasSubmitted).length,
        submissionStatusStats: [
          {
            status: 'draft',
            count: mySubs.filter((s) => s.status === 'draft').length,
            percentage: 0,
          },
          {
            status: 'submitted',
            count: mySubs.filter((s) => s.status === 'submitted').length,
            percentage: 0,
          },
          {
            status: 'ai_reviewed',
            count: mySubs.filter((s) => s.status === 'ai_reviewed').length,
            percentage: 0,
          },
          {
            status: 'teacher_reviewed',
            count: mySubs.filter((s) => s.status === 'teacher_reviewed').length,
            percentage: 0,
          },
        ],
        performanceAnalysis: {
          excellentCount: 1,
          goodCount: 0,
          passCount: 0,
          classRanking: '1/1',
          perfectScoreCount: 0,
        },
        pendingAssignmentsList: myAssignments.filter((a) => !a.hasSubmitted).map((a) => ({
          assignmentId: a.id,
          title: a.title,
          classId: a.classId,
          className: a.className,
          endDate: a.endDate,
          status: a.hasDraft ? 'draft' : 'not_started',
        })),
        recentSubmissions: mySubs.map((s) => ({
          id: s.id,
          assignmentTitle: this.assignments.find((a) => a.id === s.assignmentId)?.title || '',
          aiScore: s.aiScore,
          teacherScore: s.teacherScore,
          submittedAt: s.submittedAt || s.createdAt,
          status: s.status,
        })),
      },
      '获取成功',
    );
  }

  getLogs() {
    return this.envelope(
      {
        items: this.logs,
        total: this.logs.length,
        page: 1,
        pageSize: this.logs.length,
      },
      '获取成功',
    );
  }
}
