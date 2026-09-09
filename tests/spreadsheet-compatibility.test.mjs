import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

for (const bookType of ['xlsx', 'biff8']) {
  test(`Excel ${bookType} import and password export preserve Chinese and leading zeroes`, () => {
    const rows = [{ 姓名: '张小明', 学号: '001234', 初始密码: 'Ab-0012!汉' }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), '学生名单');
    const data = XLSX.write(book, { type: 'array', bookType });
    const imported = XLSX.read(data, { type: 'array' });
    assert.deepEqual(XLSX.utils.sheet_to_json(imported.Sheets[imported.SheetNames[0]]), rows);
  });
}
