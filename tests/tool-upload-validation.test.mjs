import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolUploadError } from '../src/views/teacher/tools/upload-validation.ts';

const file = (size, type = 'image/jpeg') => ({ name: '作文.jpg', type, size });
const mib = 1024 * 1024;
test('image limits accept the boundary and count requirements in the same batch', () => {
  const images = (sizes) => ({ maxCount: 100, label: '图片', files: sizes.map((size) => file(size * mib)) });
  assert.equal(toolUploadError([images([15, 15]), images([10])]), '');
  assert.match(toolUploadError([images([15, 15]), images([10 + 1 / mib])]), /40 MB/);
  assert.match(toolUploadError([images([15 + 1 / mib])]), /15 MB/);
});
test('unsupported, empty and excessive images explain how to recover', () => {
  const check = (files, maxCount = 5) => toolUploadError([{ files, maxCount, label: '题目图片' }]);
  assert.match(check([file(1, 'image/svg+xml')]), /JPG、PNG 或 WebP/);
  assert.match(check([file(0)]), /空文件/);
  assert.match(check(Array.from({ length: 6 }, () => file(1))), /最多选择 5 张/);
  assert.equal(check(Array.from({ length: 100 }, () => file(1)), 100), '');
});
