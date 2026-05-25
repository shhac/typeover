import type { JSX } from "solid-js";
import { For } from "solid-js";
import { goLanguage } from "@codemirror/lang-go";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import { rustLanguage } from "@codemirror/lang-rust";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import { zigLanguage } from "@ndim/codemirror-lang-zig";

type Lang = "ts" | "go" | "zig" | "rust" | "shell" | "plain";

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

function parserFor(lang: Lang) {
  if (lang === "go") return goLanguage.parser;
  if (lang === "ts") return typescriptLanguage.parser;
  if (lang === "zig") return zigLanguage.parser;
  if (lang === "rust") return rustLanguage.parser;
  return null;
}

function highlightedTokens(code: string, lang: Lang): Token[] {
  const parser = parserFor(lang);
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
  const tokens = () => highlightedTokens(props.code, props.lang);
  return <For each={tokens()}>{(token) => <span class={token.className}>{token.text}</span>}</For>;
}
