import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('teacher', 'superadmin')
  @Get('teacher/dashboard/stats')
  getTeacherDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getTeacherDashboard(currentUser.id);
  }

  @Roles('teacher', 'superadmin')
  @Get('teacher/dashboard/pending-tasks')
  getTeacherPendingTasks(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getTeacherPendingTasks(currentUser.id);
  }

  @Roles('teacher', 'superadmin')
  @Get('teacher/dashboard/performance-summary')
  getTeacherPerformanceSummary(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getTeacherPerformanceSummary(currentUser.id);
  }

  @Roles('teacher', 'superadmin')
  @Get('teacher/dashboard/quick-actions')
  getTeacherQuickActions(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getTeacherQuickActions(currentUser.id);
  }

  @Roles('student')
  @Get('student/dashboard/stats')
  getStudentDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getStudentDashboard(currentUser.id);
  }

  @Roles('student')
  @Get('student/dashboard/learning-progress')
  getStudentLearningProgress(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getStudentLearningProgress(currentUser.id);
  }

  @Roles('student')
  @Get('student/dashboard/achievements')
  getStudentAchievements(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getStudentAchievements(currentUser.id);
  }

  @Roles('student')
  @Get('student/dashboard/study-recommendations')
  getStudentRecommendations(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.dashboardService.getStudentStudyRecommendations(currentUser.id);
  }
}
