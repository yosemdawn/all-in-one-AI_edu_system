import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
const { sanitizeRichText, safeHtml } = await import('../src/utils/safe-html.ts');

test('removes stored event handlers, scripts, SVG and dangerous URLs', () => {
  const html = sanitizeRichText('<p><b>作文</b></p><img src=x onerror="alert(1)"><svg onload="alert(1)"></svg><script>alert(1)</script><a href="jav&#x61;script:alert(1)">link</a>');
  const el = dom.window.document.createElement('div');
  el.innerHTML = html;
  assert.equal(el.querySelector('b').textContent, '作文');
  assert.equal(el.querySelector('script,svg,[onerror],[onload],[href^="javascript:"]'), null);
});

test('sanitizes after Markdown conversion and when an existing result is updated', () => {
  const el = dom.window.document.createElement('div');
  safeHtml.beforeMount(el, { value: '<p>safe</p>' });
  safeHtml.updated(el, { oldValue: '<p>safe</p>', value: marked.parse('**反馈**\n\n<img src=x onerror="alert(1)">\n\n[click](javascript:alert%281%29)') });
  assert.equal(el.querySelector('strong').textContent, '反馈');
  assert.equal(el.querySelector('[onerror],[href^="javascript:"]'), null);
});

test('preserves teaching markup and removes embedded pages and CSS', () => {
  const html = sanitizeRichText('<h2>要求</h2><ol><li>第一项</li></ol><table><tr><td colspan="2">分数</td></tr></table><a href="https://example.com">资料</a><iframe srcdoc="<script>alert(1)</script>"></iframe><span style="position:fixed">text</span>');
  assert.match(html, /<h2>要求<\/h2>/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /iframe|srcdoc|style=/);
});
