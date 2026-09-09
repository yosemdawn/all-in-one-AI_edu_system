import sanitizeHtml from 'sanitize-html';

// A deliberately small HTML vocabulary; no styles, scripts, embedded pages or SVG.
export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      'p',
      'div',
      'span',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'pre',
      'code',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'a',
      'img',
      'sub',
      'sup',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}

export function sanitizeNullableRichText(value: string | null | undefined) {
  return value == null ? value : sanitizeRichText(value);
}

export function sanitizeMaterial(
  value: Record<string, unknown> | null | undefined,
) {
  return value
    ? {
        ...value,
        ...(typeof value.content === 'string'
          ? { content: sanitizeRichText(value.content) }
          : {}),
      }
    : value;
}
