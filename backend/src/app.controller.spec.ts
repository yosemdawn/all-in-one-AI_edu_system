import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsService } from './assignments/assignments.service';
import { AuthService } from './auth/auth.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClassesService } from './classes/classes.service';
import { SubmissionsService } from './submissions/submissions.service';

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
