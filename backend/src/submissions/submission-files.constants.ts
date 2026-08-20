export const SUBMISSION_UPLOAD_DIR = 'uploads/submissions';
export const MAX_SUBMISSION_FILES = 10;
export const MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_SUBMISSION_FILE_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar',
]);
