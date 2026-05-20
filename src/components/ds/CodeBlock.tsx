import type { JSX, ParentProps } from "solid-js";
import { splitProps, Show } from "solid-js";
import { cn } from "./_internal";

type Lang = "ts" | "go" | "shell" | "plain";

interface CodeBlockProps extends JSX.HTMLAttributes<HTMLPreElement> {
  lang?: Lang;
  /** Optional filename shown in the header. Use for real filenames
   *  (`users.ts`, `main.go`) — anything that would round-trip
   *  through a copy-to-clipboard "filename" path. */
  filename?: string;
  /** Optional non-filename label for the header (e.g. "your turn —
   *  type the line"). Renders in the same slot as filename when
   *  filename is absent. design-docs/17 F-10 split the slot so
   *  filename and prose-label can't pretend to be the same thing
   *  to downstream tooling. */
  label?: string;
  /** Show the language label in the corner. */
  showLang?: boolean;
}

const langLabel: Record<Lang, string> = {
  ts: "TS",
  go: "GO",
  shell: "SH",
  plain: "",
};

const langAccent: Record<Lang, string> = {
  ts: "text-accent-ts border-accent-ts/40",
  go: "text-accent-go border-accent-go/40",
  shell: "text-accent-primary border-accent-primary/40",
  plain: "text-fg-muted border-border-default",
};

const langBarBg: Record<Lang, string> = {
  ts: "bg-accent-ts/5",
  go: "bg-accent-go/5",
  shell: "bg-accent-primary/5",
  plain: "bg-bg-inset",
};

export function CodeBlock(props: ParentProps<CodeBlockProps>) {
  const [local, rest] = splitProps(props, [
    "lang",
    "filename",
    "label",
    "showLang",
    "class",
    "children",
  ]);
  const lang = local.lang ?? "plain";
  const showLang = local.showLang ?? true;
  /* Prefer filename; fall back to label. Both render in the same
   * mono-muted slot but stay typed as separate props so consumers
   * don't conflate filenames (real file paths) with prose
   * instructions. */
  const headerText = () => local.filename ?? local.label;
  return (
    <div class={cn("border border-border-default rounded-sm overflow-hidden", local.class)}>
      <Show when={headerText() !== undefined || showLang}>
        <div
          class={cn(
            "flex items-center justify-between px-3 py-1.5 border-b border-border-default",
            langBarBg[lang],
          )}
        >
          <span class="font-mono text-micro text-fg-muted">{headerText()}</span>
          <Show when={showLang && langLabel[lang]}>
            <span
              class={cn(
                "font-mono text-micro uppercase tracking-widest px-1.5 py-0.5 border rounded-sm",
                langAccent[lang],
              )}
            >
              {langLabel[lang]}
            </span>
          </Show>
        </div>
      </Show>
      <pre
        {...rest}
        class="px-4 py-3 overflow-x-auto bg-bg-inset text-fg-primary font-mono text-code leading-relaxed"
      >
        <code>{local.children}</code>
      </pre>
    </div>
  );
}
