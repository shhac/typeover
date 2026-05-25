import type { JSX, ParentProps } from "solid-js";
import { splitProps, Show } from "solid-js";
import { cn } from "./_internal";

type Lang = "ts" | "go" | "zig" | "rust" | "shell" | "plain";

interface CodeBlockProps extends JSX.HTMLAttributes<HTMLPreElement> {
  lang?: Lang;
  /** Optional filename shown in the header. Use for real filenames
   *  (`users.ts`, `main.go`) — anything that would round-trip
   *  through a copy-to-clipboard "filename" path. */
  filename?: string;
  /** Optional non-filename label for the header (e.g. a "snippet"
   *  marker). Renders in the same slot as filename when filename
   *  is absent. design-docs/17 F-10 split the slot so filename and
   *  prose-label can't pretend to be the same thing to downstream
   *  tooling. design-docs/16 F-21 retired the "your turn —" prose
   *  variants: instructions belong above the CodeBlock, not in the
   *  filename strip. */
  label?: string;
  /** Show the file icon in the tab. */
  showLang?: boolean;
}

const langIconClass: Record<Lang, string> = {
  ts: "text-accent-ts",
  go: "text-accent-go",
  zig: "text-accent-zig",
  rust: "text-accent-rust",
  shell: "text-accent-primary",
  plain: "text-fg-muted",
};

function FileIcon(props: { lang: Lang }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      class={cn("size-4 shrink-0", langIconClass[props.lang])}
    >
      <path
        d="M3.5 1.75h5.2l3.8 3.8v8.7H3.5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path
        d="M8.7 1.75v3.8h3.8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path d="M5.5 11.25h5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </svg>
  );
}

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
    <div
      class={cn("border border-border-default rounded-sm overflow-hidden bg-bg-inset", local.class)}
    >
      <Show when={headerText() !== undefined || showLang}>
        <div class="flex items-end px-2 pt-2 bg-bg-panel border-b border-border-default">
          <div class="inline-flex items-center gap-2 max-w-full px-3 py-1.5 -mb-px bg-bg-inset border border-border-default border-b-bg-inset rounded-t-sm">
            <Show when={showLang}>
              <FileIcon lang={lang} />
            </Show>
            <span class="font-mono text-micro text-fg-muted truncate">{headerText()}</span>
          </div>
        </div>
      </Show>
      <pre
        {...rest}
        class="px-4 py-4 overflow-x-auto text-fg-primary font-mono text-code leading-relaxed"
      >
        <code>{local.children}</code>
      </pre>
    </div>
  );
}
