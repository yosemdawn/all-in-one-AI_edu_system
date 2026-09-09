import { ForbiddenException } from '@nestjs/common';
import { Model } from 'mongoose';
import { AuthenticatedUser } from '../../auth/authenticated-user.interface';
import { Assignment } from '../../assignments/schemas/assignment.schema';
import { ClassMembershipDocument } from '../../classes/schemas/class-membership.schema';

export async function requireStudentAssignmentAccess(
  membershipModel: Model<ClassMembershipDocument>,
  user: AuthenticatedUser,
  assignment: Pick<Assignment, 'status' | 'classes'>,
) {
  if (user.role !== 'student' || assignment.status === 'draft') {
    throw new ForbiddenException('Assignment is not visible to this student');
  }
  const memberships = await membershipModel
    .find({
      studentId: user.id,
      classId: { $in: assignment.classes.map((item) => item.id) },
      status: 'active',
    })
    .lean();
  if (!memberships.length) {
    throw new ForbiddenException(
      'Student is not in any class for this assignment',
    );
  }
  return memberships;
}
