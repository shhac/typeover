import type { JSX, ParentProps } from "solid-js";
import { splitProps, Show } from "solid-js";
import { cn } from "./_internal";

type Lang = "ts" | "go" | "shell" | "plain";

interface CodeBlockProps extends JSX.HTMLAttributes<HTMLPreElement> {
  lang?: Lang;
  /** Optional filename / context shown in the header. */
  filename?: string;
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
  shell: "text-accent-amber border-accent-amber/40",
  plain: "text-fg-muted border-border-default",
};

const langBarBg: Record<Lang, string> = {
  ts: "bg-accent-ts/5",
  go: "bg-accent-go/5",
  shell: "bg-accent-amber/5",
  plain: "bg-bg-inset",
};

export function CodeBlock(props: ParentProps<CodeBlockProps>) {
  const [local, rest] = splitProps(props, [
    "lang",
    "filename",
    "showLang",
    "class",
    "children",
  ]);
  const lang = local.lang ?? "plain";
  const showLang = local.showLang ?? true;
  return (
    <div
      class={cn(
        "border border-border-default rounded-sm overflow-hidden",
        local.class,
      )}
    >
      <Show when={local.filename || showLang}>
        <div
          class={cn(
            "flex items-center justify-between px-3 py-1.5 border-b border-border-default",
            langBarBg[lang],
          )}
        >
          <span class="font-mono text-[11px] text-fg-muted">
            {local.filename}
          </span>
          <Show when={showLang && langLabel[lang]}>
            <span
              class={cn(
                "font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border rounded-sm",
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
        class="px-4 py-3 overflow-x-auto bg-bg-inset text-fg-primary font-mono text-[13px] leading-relaxed"
      >
        <code>{local.children}</code>
      </pre>
    </div>
  );
}
