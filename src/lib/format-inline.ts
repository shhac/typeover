/*
 * Minimal inline-markdown renderer for content strings (theme.intro,
 * module.summary, exercise.prompt, hints[*]). We render these as plain
 * `{text}` in Solid + Astro today, which means a hint like
 *
 *   "TS `let` introduces a new variable..."
 *
 * surfaces the literal backticks to the learner. This helper closes
 * that gap with the smallest possible grammar:
 *
 *   - HTML-escape every character (defence in depth — content is
 *     authored in repo YAML, but never trust the input)
 *   - `code` → <code>code</code>           (inline code)
 *   - **bold** → <strong>bold</strong>     (used in theme intros + notes)
 *
 * Italic and block-level grammar (lists, paragraphs, headings)
 * intentionally absent until content actually demands them. Authors
 * who need richer formatting should escalate to a full markdown
 * renderer; this is the 95th-percentile fix.
 *
 * Output is a string of HTML; consumers inject it via Astro's
 * `<Fragment set:html={...}>` or Solid's `innerHTML` prop.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** Match `code` spans. Lazy `+?` keeps adjacent spans (`a` `b`) from
 *  merging into one. Newlines inside a span are allowed — same as the
 *  rendered text those would survive. */
const INLINE_CODE_RE = /`([^`]+?)`/g;

/** Match **bold** spans. Lazy and non-asterisk-internal so authoring
 *  errors don't gobble across paragraphs. */
const BOLD_RE = /\*\*([^*]+?)\*\*/g;

export function formatInline(text: string): string {
  /* Order matters: escape first (content is trusted but defence in
   * depth), then code spans (can legitimately contain `*` literals,
   * so process before the bold pass), then bold. */
  let s = escapeHtml(text);
  s = s.replace(INLINE_CODE_RE, (_m, code: string) => `<code>${code}</code>`);
  s = s.replace(BOLD_RE, (_m, body: string) => `<strong>${body}</strong>`);
  return s;
}
