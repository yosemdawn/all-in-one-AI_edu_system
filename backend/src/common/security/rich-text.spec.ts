import { sanitizeRichText, sanitizeMaterial } from './rich-text';

describe('stored rich text', () => {
  it('removes executable content and encoded dangerous URLs', () => {
    expect(
      sanitizeRichText(
        '<p><strong>答案</strong></p><img src="https://example.com/a.png" onerror="alert(1)"><script>alert(1)</script><a href="jav&#x61;script:alert(1)">链接</a>',
      ),
    ).toBe(
      '<p><strong>答案</strong></p><img src="https://example.com/a.png" /><a>链接</a>',
    );
  });
  it('cleans materials without dropping non-HTML metadata', () => {
    expect(
      sanitizeMaterial({ type: 'text', content: '<p onclick="x()">题目</p>' }),
    ).toEqual({ type: 'text', content: '<p>题目</p>' });
  });
});
