import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE = 'allow-password-change';
// Only mark endpoints needed to inspect the current identity, change password or log out.
export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE, true);
