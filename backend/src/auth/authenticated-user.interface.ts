export type UserRole = 'superadmin' | 'teacher' | 'student';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'locked';
  studentId?: string;
  classId?: string;
  className?: string;
  mustChangePassword?: boolean;
  firstLoginAt?: Date;
  lastLoginAt?: Date;
  lastLogoutAt?: Date;
  passwordChangedAt?: Date;
}
