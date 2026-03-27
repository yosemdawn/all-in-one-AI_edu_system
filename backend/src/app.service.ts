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
  phone?: string;
  avatar?: string;
  meta?: Record<string, any>;
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
      modelName: 'doubao-seed-2-0-lite-260215',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: 'f6e0146b-475d-43e2-853d-d66ff226460f',
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
    if (!body.email || !body.password) {
      throw new BadRequestException('邮箱和密码不能为空');
    }
    if (this.users.some((item) => item.email === body.email)) {
      throw new BadRequestException('邮箱已存在');
    }
    if (body.username && this.users.some((item) => item.username === body.username)) {
      throw new BadRequestException('用户名已存在');
    }
    if (body.confirmPassword && body.password !== body.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

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
          name: 'TeacherDashboard',
          path: '/teacher/dashboard',
          component: 'dashboard/TeacherDashboard',
          type: 'menu',
          icon: 'House',
          meta: { title: '教学中心' },
        },
        {
          _id: 'm-tc',
          name: 'TeacherClasses',
          path: '/teacher/classes',
          component: 'teacher/classes/index',
          type: 'menu',
          icon: 'Reading',
          meta: { title: '班级管理' },
        },
        {
          _id: 'm-tc-detail',
          name: 'TeacherClassDetail',
          path: '/teacher/classes-detail',
          component: 'teacher/classes/detail/index',
          type: 'menu',
          hidden: true,
          meta: { title: '班级详情', hidden: true },
        },
        {
          _id: 'm-ta',
          name: 'TeacherAssignments',
          path: '/teacher/assignments',
          component: 'teacher/assignments/index',
          type: 'menu',
          icon: 'EditPen',
          meta: { title: '作业管理' },
        },
        {
          _id: 'm-tr',
          name: 'TeacherAiRules',
          path: '/teacher/ai-rules',
          component: 'teacher/ai-rules/index',
          type: 'menu',
          icon: 'Setting',
          meta: { title: '评分规则模板' },
        },
        {
          _id: 'm-treview',
          name: 'TeacherCorrecting',
          path: '/teacher/correcting',
          component: 'teacher/correcting/index',
          type: 'menu',
          icon: 'DocumentChecked',
          meta: { title: '待批改' },
        },
      ];
    }
    if (role === 'student') {
      return [
        {
          _id: 'm-sd',
          name: 'StudentDashboard',
          path: '/student/dashboard',
          component: 'dashboard/StudentDashboard',
          type: 'menu',
          icon: 'House',
          meta: { title: '学习中心' },
        },
        {
          _id: 'm-sc',
          name: 'StudentClasses',
          path: '/student/classes',
          component: 'student/classes/index',
          type: 'menu',
          icon: 'Reading',
          meta: { title: '我的班级' },
        },
        {
          _id: 'm-sa',
          name: 'StudentAssignments',
          path: '/student/assignments',
          component: 'student/assignments/index',
          type: 'menu',
          icon: 'EditPen',
          meta: { title: '我的作业' },
        },
      ];
    }
    return [
      {
        _id: 'm-ad',
        name: 'AdminDashboard',
        path: '/admin/dashboard',
        component: 'dashboard/AdminDashboard',
        type: 'menu',
        icon: 'Setting',
        meta: { title: '系统控制台' },
      },
      {
        _id: 'm-au',
        name: 'SystemUsers',
        path: '/system/users',
        component: 'system/users/index',
        type: 'menu',
        icon: 'User',
        meta: { title: '用户管理' },
      },
      {
        _id: 'm-am',
        name: 'SystemMenus',
        path: '/system/menus',
        component: 'system/menus/index',
        type: 'menu',
        icon: 'Menu',
        meta: { title: '菜单管理' },
      },
      {
        _id: 'm-ar',
        name: 'SystemRoles',
        path: '/system/roles',
        component: 'system/roles/index',
        type: 'menu',
        icon: 'Avatar',
        meta: { title: '角色管理' },
      },
      {
        _id: 'm-ai',
        name: 'SystemAiModel',
        path: '/system/ai_model',
        component: 'system/ai_model/index',
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
    if (params?.classId)
      items = items.filter((item) => item.classes.some((cls) => cls.id === params.classId));
    if (params?.className)
      items = items.filter((item) =>
        item.classes.some((cls) => cls.name.includes(params.className)),
      );

    const sort = params?.sort || 'createdAt';
    const order = params?.order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const getValue = (item: any) => {
        switch (sort) {
          case 'endDate':
            return new Date(item.endDate).getTime();
          case 'startDate':
            return new Date(item.startDate).getTime();
          case 'title':
            return item.title || '';
          case 'createdAt':
          default:
            return new Date(item.createdAt).getTime();
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB) * order;
      }
      return ((valueA as number) - (valueB as number)) * order;
    });

    const page = Number(params?.page || 1);
    const pageSize = Number(params?.pageSize || 10);
    const start = (page - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);

    return this.envelope(
      {
        items: pagedItems.map((item) => {
          const totalStudents = this.classMembers.filter((m) =>
            item.classes.some((c) => c.id === m.classId),
          ).length;
          const submittedCount = this.submissions.filter(
            (s) => s.assignmentId === item.id && !s.isDraft,
          ).length;
          const gradedCount = this.submissions.filter(
            (s) =>
              s.assignmentId === item.id &&
              ['ai_reviewed', 'teacher_reviewed'].includes(s.status),
          ).length;
          const pendingCount = this.submissions.filter(
            (s) => s.assignmentId === item.id && ['submitted', 'ai_reviewed'].includes(s.status),
          ).length;

          return {
            ...item,
            submissionCount: submittedCount,
            totalStudents,
            totalSubmissions: submittedCount,
            gradedSubmissions: gradedCount,
            reviewedSubmissions: gradedCount,
            pendingSubmissions: pendingCount,
          };
        }),
        total: items.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
      },
      '获取成功',
    );
  }

  getAssignment(id: string) {
    const item = this.assignments.find((assignment) => assignment.id === id);
    if (!item) throw new NotFoundException('作业不存在');

    const totalStudents = this.classMembers.filter((m) =>
      item.classes.some((c) => c.id === m.classId),
    ).length;
    const submittedCount = this.submissions.filter(
      (s) => s.assignmentId === id && !s.isDraft,
    ).length;
    const reviewedCount = this.submissions.filter(
      (s) => s.assignmentId === id && s.status === 'teacher_reviewed',
    ).length;
    const aiReviewedCount = this.submissions.filter(
      (s) => s.assignmentId === id && ['ai_reviewed', 'teacher_reviewed'].includes(s.status),
    ).length;
    const pendingCount = this.submissions.filter(
      (s) => s.assignmentId === id && ['submitted', 'ai_reviewed'].includes(s.status),
    ).length;
    const draftCount = this.submissions.filter(
      (s) => s.assignmentId === id && s.status === 'draft',
    ).length;

    return this.envelope(
      {
        ...item,
        totalStudents,
        submissionStats: {
          total: totalStudents,
          submitted: submittedCount,
          graded: aiReviewedCount,
          pending: pendingCount,
          totalSubmissions: submittedCount,
          reviewedSubmissions: reviewedCount,
          pendingSubmissions: pendingCount,
          draftSubmissions: draftCount,
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
              contentPreview: submission.content?.replace(/<[^>]*>/g, '').slice(0, 80),
              wordCount: submission.content
                ? submission.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
                : 0,
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
              contentPreview: '',
              wordCount: 0,
            };
      });

    if (params?.classId)
      items = items.filter((item) => item.classId === params.classId);
    if (params?.studentName)
      items = items.filter((item) => item.studentName?.includes(params.studentName));
    if (params?.studentNumber)
      items = items.filter((item) => item.studentNumber?.includes(params.studentNumber));

    const status = params?.submissionStatus || params?.status;
    if (status) items = items.filter((item) => item.status === status);

    const page = Number(params?.page || 1);
    const limit = Number(params?.limit || 20);
    const start = (page - 1) * limit;
    const pagedItems = items.slice(start, start + limit);

    return this.envelope(
      {
        items: pagedItems,
        total: items.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(items.length / limit)),
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

    let classes = item.classes;
    if (payload.classes) {
      classes = payload.classes.map((classId: string) => {
        const classItem = this.classes.find((cls) => cls._id === classId);
        if (!classItem) throw new NotFoundException('班级不存在');
        return { id: classItem._id, name: classItem.name };
      });
    }

    Object.assign(item, {
      ...payload,
      classes,
      allowAttachments:
        payload.allowAttachments === undefined ? item.allowAttachments : !!payload.allowAttachments,
      updatedAt: this.now(),
    });
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
    const mySubmissions = this.submissions.filter((s) => s.studentId === user.id && !s.isDraft);
    const reviewedCount = mySubmissions.filter((s) =>
      ['ai_reviewed', 'teacher_reviewed'].includes(s.status),
    ).length;

    return this.envelope(
      {
        total: assignments.length,
        pending: Math.max(assignments.length - reviewedCount, 0),
        reviewed: reviewedCount,
        submitted: mySubmissions.length,
      },
      '获取成功',
    );
  }

  submit(auth: string | undefined, payload: any) {
    const user = this.getUserByToken(auth);
    const assignment = this.assignments.find((item) => item.id === payload.assignmentId);
    if (!assignment) throw new NotFoundException('作业不存在');

    const allowedClassIds = assignment.classes.map((item) => item.id);
    const targetClassId = payload.classId || user.classId;
    if (!targetClassId || !allowedClassIds.includes(targetClassId)) {
      throw new BadRequestException('提交班级与作业班级不匹配');
    }

    const member = this.classMembers.find(
      (item) => item.studentId === user.id && item.classId === targetClassId && item.status === 'active',
    );
    if (!member) {
      throw new BadRequestException('当前学生不在该班级中，无法提交此作业');
    }

    const className =
      this.classes.find((item) => item._id === targetClassId)?.name ||
      user.className ||
      '';

    const existing = this.submissions.find(
      (item) => item.assignmentId === payload.assignmentId && item.studentId === user.id,
    );

    if (existing) {
      const previousSubmittedCount = existing.isDraft ? 0 : existing.submissionCount || 0;
      if (!payload.isDraft && existing.status === 'teacher_reviewed') {
        throw new BadRequestException('作业已被教师批改，不能再次提交');
      }
      if (!payload.isDraft && previousSubmittedCount >= 2) {
        throw new BadRequestException('已达到最大提交次数，不能再次提交');
      }

      existing.classId = targetClassId;
      existing.className = className;
      existing.content = payload.content;
      existing.attachments = payload.attachments || [];
      existing.isDraft = !!payload.isDraft;
      existing.status = payload.isDraft ? 'draft' : 'submitted';
      existing.submittedAt = payload.isDraft ? existing.submittedAt : this.now();
      existing.updatedAt = this.now();
      existing.teacherScore = undefined;
      existing.teacherReviewContent = undefined;
      existing.teacherReviewedAt = undefined;
      existing.aiScore = undefined;
      existing.aiReviewContent = undefined;
      existing.aiReviewedAt = undefined;
      existing.aiReviewMetadata = undefined;
      existing.submissionCount = payload.isDraft
        ? previousSubmittedCount
        : previousSubmittedCount + 1;
      if (!payload.isDraft) this.scheduleAiReview(existing);
      return this.envelope(existing, payload.isDraft ? '草稿保存成功' : '提交成功');
    }

    const item: Submission = {
      id: `s-${Date.now()}`,
      assignmentId: payload.assignmentId,
      studentId: user.id,
      studentName: user.name,
      studentNumber: user.studentId,
      classId: targetClassId,
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
    return this.envelope(item, payload.isDraft ? '草稿保存成功' : '提交成功');
  }

  private scheduleAiReview(submission: Submission) {
    submission.aiScore = undefined;
    submission.aiReviewContent = undefined;
    submission.aiReviewedAt = undefined;
    submission.aiReviewMetadata = undefined;

    setTimeout(() => {
      const assignment = this.assignments.find((item) => item.id === submission.assignmentId);
      const model = this.aiModels.find((item) => item.code === 'doubao' && item.status === 'active');
      const contentText = (submission.content || '').replace(/<[^>]*>/g, '').trim();
      const useFallbackReview = !assignment?.aiRule || !contentText;

      submission.status = 'ai_reviewed';
      submission.aiScore = useFallbackReview ? 0 : 88;
      submission.aiReviewContent = useFallbackReview
        ? '未能生成有效评价，请教师手动批改。'
        : '基于题目、标准答案和评分规则模板，系统判定本次作答整体较好。\n\n优点：答案结构清晰。\n问题：个别题目仍有偏差。\n建议：对照标准答案检查第2题与第4题。';
      submission.aiReviewedAt = this.now();
      submission.aiReviewMetadata = {
        provider: 'doubao',
        modelUsed: model?.modelName || 'doubao-seed-2-0-lite-260215',
        processingTime: useFallbackReview ? 800 : 1200,
        tokenUsage: { total: useFallbackReview ? 120 : 680 },
        fallback: useFallbackReview,
      };
      const member = this.classMembers.find(
        (item) =>
          item.studentId === submission.studentId && item.classId === submission.classId,
      );
      if (member) {
        member.totalSubmissions = submission.submissionCount;
        member.lastSubmissionTime = submission.submittedAt || this.now();
      }
      if (model) {
        model.totalUsage += 1;
        model.totalTokens += submission.aiReviewMetadata.tokenUsage.total;
        model.lastUsedAt = this.now();
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

  getSubmissionList(auth: string | undefined, params?: any) {
    const user = this.getUserByToken(auth);
    const teacherAssignments = this.assignments.filter((assignment) => assignment.teacherId === user.id);
    const teacherAssignmentIds = new Set(teacherAssignments.map((assignment) => assignment.id));

    let items = this.submissions.filter((item) => teacherAssignmentIds.has(item.assignmentId));
    if (params?.assignmentId)
      items = items.filter((item) => item.assignmentId === params.assignmentId);
    if (params?.classId)
      items = items.filter((item) => item.classId === params.classId);
    if (params?.status)
      items = items.filter((item) => item.status === params.status);
    if (params?.studentName)
      items = items.filter((item) => item.studentName.includes(params.studentName));
    if (params?.studentNumber)
      items = items.filter((item) => item.studentNumber?.includes(params.studentNumber));
    if (params?.minScore !== undefined)
      items = items.filter((item) => (item.teacherScore ?? item.aiScore ?? 0) >= Number(params.minScore));
    if (params?.maxScore !== undefined)
      items = items.filter((item) => (item.teacherScore ?? item.aiScore ?? 0) <= Number(params.maxScore));

    const sortBy = params?.sortBy || 'submittedAt';
    const sortOrder = params?.sortOrder === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const getValue = (item: any) => {
        switch (sortBy) {
          case 'teacherScore':
            return item.teacherScore ?? -1;
          case 'aiScore':
            return item.aiScore ?? -1;
          case 'studentName':
            return item.studentName || '';
          case 'submittedAt':
          default:
            return new Date(item.submittedAt || item.createdAt).getTime();
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB) * sortOrder;
      }
      return ((valueA as number) - (valueB as number)) * sortOrder;
    });

    const page = Number(params?.page || 1);
    const pageSize = Number(params?.limit || 20);
    const start = (page - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);

    return this.envelope(
      {
        items: pagedItems.map((item) => ({
          ...item,
          _id: item.id,
          assignmentTitle: this.assignments.find((assignment) => assignment.id === item.assignmentId)?.title || '',
          teacherName: this.assignments.find((assignment) => assignment.id === item.assignmentId)?.teacherName || '',
        })),
        total: items.length,
        page,
        pageSize,
      },
      '获取成功',
    );
  }

  getSubmissionDetail(auth: string | undefined, submissionId: string) {
    const user = this.getUserByToken(auth);
    const item = this.submissions.find((submission) => submission.id === submissionId);
    if (!item) throw new NotFoundException('提交不存在');

    const assignment = this.assignments.find((submissionAssignment) => submissionAssignment.id === item.assignmentId);
    if (!assignment || assignment.teacherId !== user.id) {
      throw new UnauthorizedException('无权查看该提交');
    }

    return this.envelope(
      {
        ...item,
        _id: item.id,
      },
      '获取成功',
    );
  }

  teacherReview(auth: string | undefined, body: any) {
    const user = this.getUserByToken(auth);
    const item = this.submissions.find((submission) => submission.id === body.submissionId);
    if (!item) throw new NotFoundException('提交不存在');

    const assignment = this.assignments.find((submissionAssignment) => submissionAssignment.id === item.assignmentId);
    if (!assignment || assignment.teacherId !== user.id) {
      throw new UnauthorizedException('无权批改该提交');
    }

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
        assignments: myAssignments.map((assignment) => {
          const totalStudents = this.classMembers.filter((member) =>
            assignment.classes.some((cls) => cls.id === member.classId),
          ).length;
          const submittedCount = this.submissions.filter(
            (submission) => submission.assignmentId === assignment.id && !submission.isDraft,
          ).length;

          return {
            id: assignment.id,
            title: assignment.title,
            classCount: assignment.classes.length,
            submissionRate: totalStudents ? Math.round((submittedCount / totalStudents) * 100) : 0,
            status: assignment.status,
            endDate: assignment.endDate,
          };
        }),
        submissions: this.submissions
          .filter(
            (submission) =>
              myAssignments.some((assignment) => assignment.id === submission.assignmentId) &&
              ['submitted', 'ai_reviewed'].includes(submission.status),
          )
          .sort(
            (a, b) =>
              new Date(b.submittedAt || b.createdAt).getTime() -
              new Date(a.submittedAt || a.createdAt).getTime(),
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

  getTeacherPerformanceSummary(auth?: string) {
    const user = this.getUserByToken(auth);
    const myAssignments = this.assignments.filter((item) => item.teacherId === user.id);
    const relatedSubmissions = this.submissions.filter((item) =>
      myAssignments.some((assignment) => assignment.id === item.assignmentId),
    );
    const scoredSubmissions = relatedSubmissions.filter(
      (item) => item.teacherScore !== undefined || item.aiScore !== undefined,
    );
    const averageScore = scoredSubmissions.length
      ? Math.round(
          scoredSubmissions.reduce(
            (sum, item) => sum + (item.teacherScore ?? item.aiScore ?? 0),
            0,
          ) / scoredSubmissions.length,
        )
      : 0;

    return this.envelope(
      {
        averageScore,
        reviewCompletionRate: relatedSubmissions.length
          ? Math.round(
              (relatedSubmissions.filter((item) => item.status === 'teacher_reviewed').length /
                relatedSubmissions.length) *
                100,
            )
          : 0,
        aiReviewCoverage: relatedSubmissions.length
          ? Math.round(
              (relatedSubmissions.filter((item) => item.aiScore !== undefined).length /
                relatedSubmissions.length) *
                100,
            )
          : 0,
        assignmentCount: myAssignments.length,
      },
      '获取成功',
    );
  }

  getTeacherQuickActions(auth?: string) {
    const user = this.getUserByToken(auth);
    const myAssignments = this.assignments.filter((item) => item.teacherId === user.id);
    const firstPendingAssignment = myAssignments.find((assignment) =>
      this.submissions.some(
        (submission) =>
          submission.assignmentId === assignment.id &&
          ['submitted', 'ai_reviewed'].includes(submission.status),
      ),
    );

    return this.envelope(
      [
        {
          key: 'classes',
          title: '查看班级',
          path: '/teacher/classes',
        },
        {
          key: 'new-assignment',
          title: '新建作业',
          path: '/teacher/assignmentsEdit',
        },
        {
          key: 'pending-review',
          title: '进入待批改',
          path: firstPendingAssignment
            ? `/teacher/assignments/detail?id=${firstPendingAssignment.id}&openFirstPending=true`
            : '/teacher/assignments',
        },
      ],
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
    const completedSubmissions = mySubs.filter((s) => !s.isDraft).length;

    return this.envelope(
      {
        completedSubmissions,
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
            percentage: mySubs.length
              ? Math.round((mySubs.filter((s) => s.status === 'draft').length / mySubs.length) * 100)
              : 0,
          },
          {
            status: 'submitted',
            count: mySubs.filter((s) => s.status === 'submitted').length,
            percentage: mySubs.length
              ? Math.round((mySubs.filter((s) => s.status === 'submitted').length / mySubs.length) * 100)
              : 0,
          },
          {
            status: 'ai_reviewed',
            count: mySubs.filter((s) => s.status === 'ai_reviewed').length,
            percentage: mySubs.length
              ? Math.round((mySubs.filter((s) => s.status === 'ai_reviewed').length / mySubs.length) * 100)
              : 0,
          },
          {
            status: 'teacher_reviewed',
            count: mySubs.filter((s) => s.status === 'teacher_reviewed').length,
            percentage: mySubs.length
              ? Math.round((mySubs.filter((s) => s.status === 'teacher_reviewed').length / mySubs.length) * 100)
              : 0,
          },
        ],
        performanceAnalysis: {
          excellentCount: mySubs.filter((s) => (s.teacherScore || s.aiScore || 0) >= 90).length,
          goodCount: mySubs.filter((s) => {
            const score = s.teacherScore || s.aiScore || 0;
            return score >= 80 && score < 90;
          }).length,
          passCount: mySubs.filter((s) => {
            const score = s.teacherScore || s.aiScore || 0;
            return score >= 60 && score < 80;
          }).length,
          classRanking: '1/1',
          perfectScoreCount: mySubs.filter((s) => (s.teacherScore || s.aiScore || 0) === 100).length,
        },
        pendingAssignmentsList: myAssignments.filter((a) => !a.hasSubmitted).map((a) => ({
          assignmentId: a.id,
          title: a.title,
          classId: a.classId,
          className: a.className,
          endDate: a.endDate,
          status: a.hasDraft ? 'draft' : 'not_started',
        })),
        recentSubmissions: mySubs
          .slice()
          .sort(
            (a, b) =>
              new Date(b.submittedAt || b.createdAt).getTime() -
              new Date(a.submittedAt || a.createdAt).getTime(),
          )
          .map((s) => ({
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

  getStudentLearningProgress(auth?: string) {
    const user = this.getUserByToken(auth);
    const myAssignments = this.assignments.filter((item) =>
      item.classes.some((cls) => cls.id === user.classId),
    );
    const mySubmissions = this.submissions.filter(
      (item) => item.studentId === user.id && !item.isDraft,
    );

    return this.envelope(
      {
        totalAssignments: myAssignments.length,
        completedAssignments: mySubmissions.length,
        completionRate: myAssignments.length
          ? Math.round((mySubmissions.length / myAssignments.length) * 100)
          : 0,
      },
      '获取成功',
    );
  }

  getStudentAchievements(auth?: string) {
    const user = this.getUserByToken(auth);
    const mySubmissions = this.submissions.filter(
      (item) => item.studentId === user.id && !item.isDraft,
    );

    return this.envelope(
      {
        excellentCount: mySubmissions.filter((item) => (item.teacherScore || item.aiScore || 0) >= 90).length,
        reviewedCount: mySubmissions.filter((item) =>
          ['ai_reviewed', 'teacher_reviewed'].includes(item.status),
        ).length,
        streakDays: mySubmissions.length ? 1 : 0,
      },
      '获取成功',
    );
  }

  getStudentStudyRecommendations(auth?: string) {
    const user = this.getUserByToken(auth);
    const pendingAssignments = this.assignments.filter(
      (item) =>
        item.classes.some((cls) => cls.id === user.classId) &&
        !this.submissions.some(
          (submission) =>
            submission.assignmentId === item.id &&
            submission.studentId === user.id &&
            !submission.isDraft,
        ),
    );

    return this.envelope(
      pendingAssignments.slice(0, 3).map((item) => ({
        assignmentId: item.id,
        title: item.title,
        recommendation: '建议优先完成这份作业，并根据标准答案检查易错点。',
      })),
      '获取成功',
    );
  }

  getUsers(params?: any) {
    let items = [...this.users];

    if (params?.role) {
      items = items.filter((item) => item.role === params.role);
    }

    if (params?.status) {
      items = items.filter((item) => {
        const status = item.status === 'locked' ? 'inactive' : item.status;
        return status === params.status;
      });
    }

    if (params?.keyword) {
      const keyword = String(params.keyword).toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.email.toLowerCase().includes(keyword) ||
          item.username.toLowerCase().includes(keyword) ||
          item.studentId?.toLowerCase().includes(keyword) ||
          item.phone?.toLowerCase().includes(keyword),
      );
    }

    const page = Number(params?.page || 1);
    const limit = Number(params?.limit || 10);
    const start = (page - 1) * limit;
    const pagedItems = items.slice(start, start + limit).map((item) => ({
      _id: item.id,
      username: item.username,
      email: item.email,
      name: item.name,
      role: item.role,
      status: item.status === 'locked' ? 'inactive' : item.status,
      studentId: item.studentId,
      phone: item.phone,
      avatar: item.avatar,
      meta: item.meta,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return this.envelope(
      {
        items: pagedItems,
        total: items.length,
        page,
        limit,
      },
      '获取成功',
    );
  }

  getUser(id: string) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('用户不存在');

    return this.envelope(
      {
        _id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status === 'locked' ? 'inactive' : user.status,
        studentId: user.studentId,
        phone: user.phone,
        avatar: user.avatar,
        meta: user.meta,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      '获取成功',
    );
  }

  createUser(body: any) {
    if (!body.username || !body.email || !body.password || !body.name) {
      throw new BadRequestException('用户名、姓名、邮箱和密码不能为空');
    }
    if (this.users.some((item) => item.username === body.username)) {
      throw new BadRequestException('用户名已存在');
    }
    if (this.users.some((item) => item.email === body.email)) {
      throw new BadRequestException('邮箱已存在');
    }
    if (body.role === 'student' && body.studentId && this.users.some((item) => item.studentId === body.studentId)) {
      throw new BadRequestException('学号已存在');
    }

    const now = this.now();
    const user: User = {
      id: `u-${Date.now()}`,
      username: body.username,
      email: body.email,
      name: body.name,
      role: body.role || 'student',
      status: body.status || 'active',
      password: body.password,
      studentId: body.role === 'student' ? body.studentId || `${Math.floor(10000000 + Math.random() * 90000000)}` : undefined,
      phone: body.phone,
      avatar: body.avatar,
      meta: body.meta,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(user);
    return this.getUser(user.id);
  }

  updateUser(id: string, body: any) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('用户不存在');

    if (body.email && this.users.some((item) => item.id !== id && item.email === body.email)) {
      throw new BadRequestException('邮箱已存在');
    }
    if (body.studentId && this.users.some((item) => item.id !== id && item.studentId === body.studentId)) {
      throw new BadRequestException('学号已存在');
    }

    Object.assign(user, {
      email: body.email ?? user.email,
      name: body.name ?? user.name,
      role: body.role ?? user.role,
      status: body.status ?? user.status,
      studentId: body.role === 'student' || (!body.role && user.role === 'student') ? body.studentId ?? user.studentId : undefined,
      phone: body.phone ?? user.phone,
      avatar: body.avatar ?? user.avatar,
      meta: body.meta ?? user.meta,
      updatedAt: this.now(),
    });

    return this.getUser(id);
  }

  updateProfile(auth: string | undefined, body: any) {
    const user = this.getUserByToken(auth);
    if (body.email && this.users.some((item) => item.id !== user.id && item.email === body.email)) {
      throw new BadRequestException('邮箱已存在');
    }

    Object.assign(user, {
      email: body.email ?? user.email,
      name: body.name ?? user.name,
      phone: body.phone ?? user.phone,
      avatar: body.avatar ?? user.avatar,
      meta: body.meta ?? user.meta,
      updatedAt: this.now(),
    });

    return this.getUser(user.id);
  }

  updatePassword(auth: string | undefined, body: any) {
    const user = this.getUserByToken(auth);
    if (!body?.currentPassword || user.password !== body.currentPassword) {
      throw new BadRequestException('当前密码错误');
    }
    if (!body?.newPassword || String(body.newPassword).length < 6) {
      throw new BadRequestException('新密码长度不能少于6位');
    }

    user.password = body.newPassword;
    user.mustChangePassword = false;
    user.updatedAt = this.now();
    return this.envelope({ success: true }, '修改成功');
  }

  updateUserPassword(id: string, body: any) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('用户不存在');
    if (!body?.newPassword || String(body.newPassword).length < 6) {
      throw new BadRequestException('新密码长度不能少于6位');
    }

    user.password = body.newPassword;
    user.updatedAt = this.now();
    return this.envelope({ success: true, message: '修改成功' }, '修改成功');
  }

  resetUserPassword(id: string, body?: any) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('用户不存在');

    const newPassword = body?.newPassword || '123456';
    user.password = newPassword;
    user.mustChangePassword = true;
    user.updatedAt = this.now();
    return this.envelope({ success: true, id, newPassword }, '重置成功');
  }

  deleteUser(id: string) {
    const index = this.users.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('用户不存在');

    const user = this.users[index];
    if (user.role === 'superadmin') {
      throw new BadRequestException('超级管理员不能删除');
    }

    this.users.splice(index, 1);

    if (user.classId) {
      const classItem = this.classes.find((item) => item._id === user.classId);
      if (classItem && classItem.studentCount > 0) classItem.studentCount -= 1;
    }

    for (let i = this.classMembers.length - 1; i >= 0; i -= 1) {
      if (this.classMembers[i].studentId === id) {
        this.classMembers.splice(i, 1);
      }
    }

    return this.envelope({ success: true, id }, '删除成功');
  }

  importUsers(body: any[]) {
    const items = Array.isArray(body) ? body : [];
    const success: any[] = [];
    const failed: Array<{ index: number; reason: string }> = [];

    items.forEach((item, index) => {
      try {
        this.createUser({
          username: item.username || item.email || `user${Date.now()}${index}`,
          email: item.email,
          password: item.password || '123456',
          name: item.name || item.username || `用户${index + 1}`,
          role: item.role || 'student',
          studentId: item.studentId,
          phone: item.phone,
          status: item.status || 'active',
        });
        success.push(item);
      } catch (error: any) {
        failed.push({ index, reason: error?.message || '导入失败' });
      }
    });

    return this.envelope(
      {
        success: failed.length === 0,
        total: items.length,
        successCount: success.length,
        failureCount: failed.length,
        failures: failed,
      },
      '导入成功',
    );
  }

  deleteUsers(body: any) {
    const userIds = Array.isArray(body?.userIds) ? body.userIds : [];
    const failures: Array<{ userId: string; reason: string }> = [];
    let successCount = 0;

    userIds.forEach((userId) => {
      try {
        this.deleteUser(userId);
        successCount += 1;
      } catch (error: any) {
        failures.push({ userId, reason: error?.message || '删除失败' });
      }
    });

    return this.envelope(
      {
        success: failures.length === 0,
        total: userIds.length,
        successCount,
        failureCount: failures.length,
        failures,
      },
      '删除成功',
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
