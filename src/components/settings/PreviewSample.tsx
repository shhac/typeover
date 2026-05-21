import {
  Badge,
  Button,
  CodeBlock,
  Eyebrow,
  Kbd,
  Panel,
  ProgressChip,
  Stack,
  Text,
} from "~/components/ds";

/*
 * Focused mini-canvas showing the visual elements every appearance
 * axis touches: surface colours (theme), padding/gap (density),
 * corner radii (radius), style chrome, palette accents. Pure DS
 * composition — no localStorage reads, no Solid signals; the CSS
 * cascade fans the picker's mutations through every primitive at
 * once. Per design-docs/14 step 6.
 *
 * Extracted from AppearancePicker per the structural review's
 * file-decomposition lens — keeps the picker focused on its
 * radio-group orchestration; this file owns the demo surface.
 */
export function PreviewSample() {
  return (
    <Panel padding="default" tone="default">
      <Stack gap="md">
        <Stack gap="xs">
          <Eyebrow>preview</Eyebrow>
          <Text tone="muted" size="xs" family="mono">
            A miniature of the site — every change above flows through here.
          </Text>
        </Stack>
        <Stack direction="row" gap="sm" align="center" wrap>
          <Button variant="primary" size="sm">
            Submit
          </Button>
          <Button variant="secondary" size="sm">
            Run
          </Button>
          <Button variant="ghost" size="sm">
            <Kbd>↵</Kbd>
            <span>enter</span>
          </Button>
        </Stack>
        <Stack direction="row" gap="sm" align="center" wrap>
          <Badge variant="ts">typescript</Badge>
          <Badge variant="go">golang</Badge>
          <Badge variant="primary">focus</Badge>
          <ProgressChip kind="theme" passed={4} total={9} />
        </Stack>
        <CodeBlock lang="go" filename="preview.go">{`package main

import "fmt"

func main() {
\tfmt.Println("hello")
}`}</CodeBlock>
      </Stack>
    </Panel>
  );
}
