import { formatInline } from "./format-inline";

/*
 * Block-level companion to formatInline. Recognises just enough of
 * Markdown's block grammar to render theme intros + module summaries
 * properly without pulling in a full markdown library:
 *
 *   - A blank line breaks the current run (paragraph OR list).
 *   - A `- ` or `* ` line marker starts (or continues) a list,
 *     even if it interrupts a paragraph mid-block. (CommonMark
 *     allows this; pure-blank-line splitting did not, which is why
 *     the shipped theme intros render their list-items as literal
 *     hyphens — the lists immediately follow prose without a blank.)
 *   - Otherwise the line continues (or starts) a paragraph.
 *
 * Each emitted line runs through formatInline first, so `code`,
 * **bold**, and HTML-escape rules apply inside list items and
 * paragraphs.
 *
 * Output is a single HTML string. Consumers inject via Astro's
 * `<Fragment set:html={...}>`.
 *
 * What's deliberately NOT supported:
 *   - Headings (#, ##) — theme intros shouldn't have them.
 *   - Nested lists — flatten or break into separate blocks.
 *   - Numbered lists — promote to bullet points or use `1.` literally.
 *   - Code fences (``` ```) — code ships via the dedicated CodeBlock
 *     component, not via prose.
 *
 * If content authoring ever genuinely needs more, escalate to a
 * proper markdown library (e.g. `marked` or `micromark`) rather
 * than growing this regex pile.
 */

const LIST_MARKER_RE = /^\s*[-*]\s+/;
const INDENTED_RE = /^\s+\S/;

type Run = { kind: "para"; lines: string[] } | { kind: "list"; items: string[] };

export function formatBlock(text: string): string {
  const runs: Run[] = [];
  let current: Run | null = null;

  const flush = () => {
    if (current) {
      runs.push(current);
      current = null;
    }
  };

  for (const rawLine of text.split("\n")) {
    if (rawLine.trim() === "") {
      flush();
      continue;
    }
    /* New list marker — starts (or continues) a list run, one item
     * per marker. */
    if (LIST_MARKER_RE.test(rawLine)) {
      if (current?.kind !== "list") {
        flush();
        current = { kind: "list", items: [] };
      }
      current.items.push(rawLine.trimEnd().replace(LIST_MARKER_RE, ""));
      continue;
    }
    /* Indented continuation of the current list item. CommonMark
     * allows multi-line list items by indenting the continuation
     * lines past the marker; join into the last item with a single
     * space (same collapse rule as paragraphs). */
    if (current?.kind === "list" && INDENTED_RE.test(rawLine)) {
      const last = current.items.length - 1;
      current.items[last] = `${current.items[last]} ${rawLine.trim()}`;
      continue;
    }
    /* Plain prose line. */
    if (current?.kind !== "para") {
      flush();
      current = { kind: "para", lines: [] };
    }
    current.lines.push(rawLine.trimEnd());
  }
  flush();

  return runs
    .map((run) => {
      if (run.kind === "list") {
        const items = run.items.map((i) => `<li>${formatInline(i)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      /* Markdown convention: lines in a paragraph collapse to one
       * space. Inline `code` spans never break across lines so the
       * collapse is safe. */
      return `<p>${formatInline(run.lines.join(" "))}</p>`;
    })
    .join("");
}
