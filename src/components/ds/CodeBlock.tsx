import type { JSX, ParentProps } from "solid-js";
import { For, splitProps, Show } from "solid-js";
import { IconFileGeneric } from "~/components/icons/icon-file-generic";
import { IconFileGo } from "~/components/icons/icon-file-go";
import { IconFileRs } from "~/components/icons/icon-file-rs";
import { IconFileTs } from "~/components/icons/icon-file-ts";
import { IconFileZig } from "~/components/icons/icon-file-zig";
import { cn } from "./_internal";

type Lang = "ts" | "go" | "zig" | "rust" | "shell" | "plain";

interface CodeBlockTab {
  id: string;
  label: string;
  lang?: Lang;
  selected?: boolean;
  onSelect?: () => void;
}

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
  /** Optional interactive file tabs. Used when one code pane can show multiple target files. */
  tabs?: readonly CodeBlockTab[];
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
  const className = cn("size-4 shrink-0", langIconClass[props.lang]);
  if (props.lang === "ts") return <IconFileTs class={className} />;
  if (props.lang === "go") return <IconFileGo class={className} />;
  if (props.lang === "zig") return <IconFileZig class={className} />;
  if (props.lang === "rust") return <IconFileRs class={className} />;
  return <IconFileGeneric class={className} />;
}

const staticTabClass =
  "inline-flex items-center gap-2 max-w-full px-3 py-1.5 -mb-px bg-bg-inset border border-border-default border-b-bg-inset rounded-t-sm";

function interactiveTabClass(selected: boolean): string {
  return cn(
    "inline-flex items-center gap-2 max-w-full px-3 py-1.5 -mb-px border rounded-t-sm font-sans text-sm transition-colors focus-ring",
    selected
      ? "bg-bg-inset border-border-default border-b-bg-inset text-fg-primary"
      : "bg-bg-panel border-transparent text-fg-muted hover:bg-bg-elevated hover:text-fg-secondary",
  );
}

export function CodeBlock(props: ParentProps<CodeBlockProps>) {
  const [local, rest] = splitProps(props, [
    "lang",
    "filename",
    "label",
    "showLang",
    "tabs",
    "class",
    "children",
  ]);
  const lang = local.lang ?? "plain";
  const showLang = local.showLang ?? true;
  const hasTabs = () => (local.tabs?.length ?? 0) > 0;
  /* Prefer filename; fall back to label. Both render in the same
   * mono-muted slot but stay typed as separate props so consumers
   * don't conflate filenames (real file paths) with prose
   * instructions. */
  const headerText = () => local.filename ?? local.label;
  return (
    <div
      class={cn("border border-border-default rounded-sm overflow-hidden bg-bg-inset", local.class)}
    >
      <Show when={headerText() !== undefined || showLang || hasTabs()}>
        <div class="flex items-end px-2 pt-2 bg-bg-panel border-b border-border-default">
          <Show
            when={hasTabs()}
            fallback={
              <div class={staticTabClass}>
                <Show when={showLang}>
                  <FileIcon lang={lang} />
                </Show>
                <span class="font-mono text-micro text-fg-muted truncate">{headerText()}</span>
              </div>
            }
          >
            <div
              class="flex flex-row gap-1 overflow-x-auto"
              role="tablist"
              aria-label="Code file tabs"
            >
              <For each={local.tabs}>
                {(tab) => {
                  const tabLang = () => tab.lang ?? "plain";
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab.selected ? "true" : "false"}
                      class={interactiveTabClass(tab.selected ?? false)}
                      onClick={() => tab.onSelect?.()}
                    >
                      <FileIcon lang={tabLang()} />
                      <span class="truncate">{tab.label}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
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
