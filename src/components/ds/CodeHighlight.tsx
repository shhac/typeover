import type { JSX } from "solid-js";
import { createSignal, For, onMount, Show } from "solid-js";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import type { Parser } from "@lezer/common";
import { assertUnreachable } from "~/lib/assert-unreachable";

/*
 * Solid-side syntax highlighter for read-only code panes.
 *
 * Each language grammar is dynamic-imported. Static imports here
 * previously hoisted four ~100 KB CodeMirror language packs into
 * the shared `CodeBlock` client chunk (594 KB minified — over Vite's
 * 500 KB warning). Splitting them per language means the homepage
 * `HomepageDrill` no longer ships the Go + Zig + Rust grammars for
 * a TS-only drill, and exercise pages only pay for the grammar
 * their target uses.
 *
 * Loading shape:
 *   - On mount the parser for `props.lang` is requested via
 *     `createResource`. First paint renders the raw `props.code` as
 *     a single unhighlighted `<span>` — the "plain" fallback path.
 *   - When the parser resolves, the resource updates and the
 *     component re-renders tokenised output.
 *   - `parserCache` memoises the resolved parser per Lang so each
 *     grammar's chunk is fetched at most once per session
 *     regardless of how many `<CodeHighlight>` instances mount.
 *
 * The shape of `cmLanguageExtension` in `src/lib/codemirror-lang.ts`
 * is the same pattern on the editor side; keep them in lock-step
 * when adding a new language.
 */

export type Lang = "ts" | "go" | "zig" | "rust" | "shell" | "plain";

interface Token {
  text: string;
  className?: string;
}

const highlighter = tagHighlighter([
  { tag: [tags.keyword, tags.controlKeyword, tags.modifier], class: "text-accent-primary" },
  {
    tag: [tags.function(tags.variableName), tags.definition(tags.function(tags.variableName))],
    class: "text-accent-primary",
  },
  { tag: [tags.string, tags.character, tags.special(tags.string)], class: "text-success" },
  { tag: [tags.typeName, tags.className], class: "text-accent-go" },
  { tag: [tags.number, tags.bool, tags.null, tags.literal], class: "text-accent-ts" },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    class: "text-fg-faint italic",
  },
  { tag: [tags.operator, tags.punctuation, tags.derefOperator], class: "text-fg-secondary" },
  { tag: [tags.variableName, tags.propertyName, tags.attributeName], class: "text-fg-primary" },
  { tag: [tags.escape, tags.regexp], class: "text-success" },
  { tag: tags.meta, class: "text-fg-muted" },
]);

/* Memoise resolved parsers so a page that renders multiple
 * `<CodeHighlight lang="go">` panes only pays the grammar download
 * once. The cached value can be `null` (shell / plain — no parser);
 * an absent key means "not yet loaded". */
const parserCache = new Map<Lang, Parser | null>();

/** Dynamic-import the Lezer parser for a given language. Returns
 *  `null` for langs without a parser (shell / plain). Each `case`
 *  emits a separate chunk; the `switch + assertUnreachable` makes
 *  adding a new Lang member fail typecheck until a matching branch
 *  lands. */
export async function loadParser(lang: Lang): Promise<Parser | null> {
  const cached = parserCache.get(lang);
  if (cached !== undefined) return cached;

  const parser = await resolveParser(lang);
  parserCache.set(lang, parser);
  return parser;
}

async function resolveParser(lang: Lang): Promise<Parser | null> {
  switch (lang) {
    case "go": {
      const { goLanguage } = await import("@codemirror/lang-go");
      return goLanguage.parser;
    }
    case "ts": {
      const { typescriptLanguage } = await import("@codemirror/lang-javascript");
      return typescriptLanguage.parser;
    }
    case "zig": {
      const { zigLanguage } = await import("@ndim/codemirror-lang-zig");
      return zigLanguage.parser;
    }
    case "rust": {
      const { rustLanguage } = await import("@codemirror/lang-rust");
      return rustLanguage.parser;
    }
    case "shell":
    case "plain":
      return null;
    default:
      return assertUnreachable(lang);
  }
}

/** Tokenise `code` against a resolved Lezer parser. Returns a
 *  single plaintext token when the parser is null (unsupported
 *  lang or grammar not yet loaded) or the code is empty. Pure —
 *  takes a parser rather than re-resolving inside. */
export function highlightedTokens(code: string, parser: Parser | null): Token[] {
  if (!parser || code === "") return [{ text: code }];

  const ranges: Array<{ from: number; to: number; className: string }> = [];
  highlightTree(parser.parse(code), highlighter, (from, to, className) => {
    ranges.push({ from, to, className });
  });

  const tokens: Token[] = [];
  let cursor = 0;
  for (const range of ranges.sort((a, b) => a.from - b.from || a.to - b.to)) {
    if (range.from < cursor) continue;
    if (cursor < range.from) tokens.push({ text: code.slice(cursor, range.from) });
    tokens.push({ text: code.slice(range.from, range.to), className: range.className });
    cursor = range.to;
  }
  if (cursor < code.length) tokens.push({ text: code.slice(cursor) });

  return tokens;
}

export function CodeHighlight(props: { code: string; lang: Lang }): JSX.Element {
  /* Solid SSR can't serialize a Lezer Parser (deep internal state +
   * Uint16Array tables — seroval throws on unsupported types). Use
   * a plain signal loaded inside `onMount` so SSR renders the
   * unhighlighted fallback, then the hydrated client fetches the
   * grammar chunk and rerenders with tokenized output. */
  const [parser, setParser] = createSignal<Parser | null>(null);
  onMount(() => {
    void loadParser(props.lang).then(setParser);
  });
  return (
    <Show
      when={parser()}
      fallback={<span>{props.code}</span>}
    >
      {(p) => (
        <For each={highlightedTokens(props.code, p())}>
          {(token) => <span class={token.className}>{token.text}</span>}
        </For>
      )}
    </Show>
  );
}
