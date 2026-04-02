import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsService } from './assignments/assignments.service';
import { AuthService } from './auth/auth.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminService } from './admin/admin.service';
import { ClassesService } from './classes/classes.service';
import { DashboardService } from './dashboard/dashboard.service';
import { SubmissionsService } from './submissions/submissions.service';
import { UsersService } from './users/users.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            logout: jest.fn(),
            refresh: jest.fn(),
            profile: jest.fn(),
            changePassword: jest.fn(),
            firstChangePassword: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            register: jest.fn(),
          },
        },
        {
          provide: ClassesService,
          useValue: {
            getClasses: jest.fn(),
            getClass: jest.fn(),
            createClass: jest.fn(),
            updateClass: jest.fn(),
            closeClass: jest.fn(),
            regenerateCode: jest.fn(),
            getClassStudents: jest.fn(),
            addStudents: jest.fn(),
            joinClass: jest.fn(),
            updateStudentStatus: jest.fn(),
            leaveClass: jest.fn(),
          },
        },
        {
          provide: AssignmentsService,
          useValue: {
            listAssignments: jest.fn(),
            getAssignment: jest.fn(),
            getAssignmentStudents: jest.fn(),
            createAssignment: jest.fn(),
            updateAssignment: jest.fn(),
            updateAssignmentStatus: jest.fn(),
            deleteAssignment: jest.fn(),
            getStudentAssignments: jest.fn(),
            getStudentAssignmentStatistics: jest.fn(),
            getStudentAssignment: jest.fn(),
          },
        },
        {
          provide: SubmissionsService,
          useValue: {
            submit: jest.fn(),
            getMySubmission: jest.fn(),
            deleteSubmission: jest.fn(),
            getSubmissionList: jest.fn(),
            getSubmissionDetail: jest.fn(),
            teacherReview: jest.fn(),
          },
        },
        {
          provide: DashboardService,
          useValue: {
            getTeacherDashboard: jest.fn(),
            getTeacherPendingTasks: jest.fn(),
            getTeacherPerformanceSummary: jest.fn(),
            getTeacherQuickActions: jest.fn(),
            getStudentDashboard: jest.fn(),
            getStudentLearningProgress: jest.fn(),
            getStudentAchievements: jest.fn(),
            getStudentStudyRecommendations: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getUsers: jest.fn(),
            createUser: jest.fn(),
            getCurrentUserProfile: jest.fn(),
            updateCurrentUserProfile: jest.fn(),
            updateCurrentUserPassword: jest.fn(),
            getUser: jest.fn(),
            updateUser: jest.fn(),
            updateUserPassword: jest.fn(),
            resetUserPassword: jest.fn(),
            deleteUser: jest.fn(),
            importUsers: jest.fn(),
            deleteUsers: jest.fn(),
          },
        },
        {
          provide: AdminService,
          useValue: {
            getOverview: jest.fn(),
            getRecentUsers: jest.fn(),
            getHealth: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return backend readiness envelope', () => {
      expect(appController.getHello()).toEqual({
        code: 200,
        message: 'backend ready',
        data: {
          name: 'nengdou-backend',
          ok: true,
        },
      });
    });
  });
});
