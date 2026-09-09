import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('progress card renders real stages, counts and terminal errors', async () => {
  const filename = resolve('src/views/teacher/tools/ToolTaskProgress.vue');
  const { descriptor } = parse(await readFile(filename, 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'progress-test', inlineTemplate: true });
  const shared = pathToFileURL(resolve('src/views/teacher/tools/shared.ts')).href;
  const source = ts.transpileModule(script.content.replace(/from ["']\.\/shared["']/g, `from ${JSON.stringify(shared)}`), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  await mkdir('.temp', { recursive: true });
  const compiled = resolve(`.temp/tool-progress-${process.pid}.mjs`);
  await writeFile(compiled, source);
  try {
    const Component = (await import(pathToFileURL(compiled).href)).default;
    const render = async task => {
      const app = createSSRApp(Component, { task });
      app.component('el-progress', { props: ['percentage'], render() { return h('span', `${this.percentage}%`); } });
      return renderToString(app);
    };
    const task = { status: 'processing', totalCount: 10, processedCount: 3, successCount: 2, failureCount: 1, items: [], createdAt: new Date().toISOString(), progress: { stage: 'reviewing', currentIndex: 4, currentFileName: '作文4.png' } };
    const active = await render(task);
    assert.match(active, /正在批阅作文/);
    assert.match(active, /已处理 3 \/ 10 张/);
    assert.match(active, /第 4 张：作文4.png/);
    assert.match(active, /30%/);
    const preparing = await render({ ...task, processedCount: 0, progress: { stage: 'requirements' } });
    assert.match(preparing, /正在识别作文要求/);
    assert.match(preparing, /0%/);
    const failed = await render({ ...task, status: 'failed', resultSummary: { error: '图片无法识别' } });
    assert.match(failed, /图片无法识别/);
    assert.doesNotMatch(failed, /正在批阅作文/);
    const cancelled = await render({ ...task, status: 'cancelled' });
    assert.match(cancelled, /已取消/);
    assert.doesNotMatch(cancelled, /第 4 张/);
  } finally { await unlink(compiled); }
});
