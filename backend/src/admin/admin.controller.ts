import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getAdminOverview() {
    return this.adminService.getOverview();
  }

  @Get('recent-users')
  getRecentUsers(@Query('limit') limit?: number) {
    return this.adminService.getRecentUsers(limit);
  }

  @Get('health')
  getHealth() {
    return this.adminService.getHealth();
  }
}
