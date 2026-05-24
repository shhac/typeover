import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { Badge } from "./Badge";
import { Stack } from "./Stack";
import { Text } from "./Text";
import { cn } from "./_internal";

interface LangCrumbsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Source language. Defaults to "ts". */
  from?: "ts" | "go" | "zig" | "rust";
  /** Target language. Defaults to "go". */
  to?: "ts" | "go" | "zig" | "rust";
}

/**
 * Top-of-page "TS → GO" language strip used on every learner-facing
 * page. Outline badges + arrow glyph in one place, so any future
 * change to the chrome lands once.
 *
 * Children render *after* the language pair as breadcrumb extras
 * (theme name, exercise number, etc.).
 */
export function LangCrumbs(props: ParentProps<LangCrumbsProps>) {
  const [local, rest] = splitProps(props, ["from", "to", "class", "children"]);
  return (
    <Stack {...rest} direction="row" gap="sm" align="center" wrap class={cn(local.class)}>
      <Badge variant={local.from ?? "ts"} outline>
        {(local.from ?? "ts").toUpperCase()}
      </Badge>
      <Text tone="muted" size="sm" family="mono">
        →
      </Text>
      <Badge variant={local.to ?? "go"} outline>
        {(local.to ?? "go").toUpperCase()}
      </Badge>
      {local.children}
    </Stack>
  );
}
