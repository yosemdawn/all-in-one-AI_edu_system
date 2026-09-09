import DOMPurify from "dompurify";
import type { Directive } from "vue";

export function sanitizeRichText(value: unknown): string {
  return DOMPurify.sanitize(String(value ?? ""), {
    ALLOWED_TAGS: [
      "p",
      "div",
      "span",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "blockquote",
      "pre",
      "code",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "img",
      "sub",
      "sup",
      "hr",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "src",
      "alt",
      "width",
      "height",
      "colspan",
      "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

// Sanitize at the final DOM sink, including HTML produced from Markdown or old records.
export const safeHtml: Directive<HTMLElement, unknown> = {
  beforeMount(el, binding) {
    el.innerHTML = sanitizeRichText(binding.value);
  },
  updated(el, binding) {
    if (binding.value !== binding.oldValue)
      el.innerHTML = sanitizeRichText(binding.value);
  },
};
