import { createSignal, For } from "solid-js";
import { Button, ButtonLink, CodeBlock, Stack, Text } from "~/components/ds";

type TargetId = "go" | "zig" | "rust";

const choices: Record<
  TargetId,
  {
    label: string;
    filename: string;
    code: string;
    note: string;
    startHref: string;
    browseHref: string;
  }
> = {
  go: {
    label: "Go",
    filename: "count.go",
    code: `count := len(users)
fmt.Println(count)`,
    note: "Correct in Go: length is a builtin function, and printing goes through fmt.",
    startHref: "/go/foundations/variables/01",
    browseHref: "/go",
  },
  zig: {
    label: "Zig",
    filename: "count.zig",
    code: `const count = users.len;
std.debug.print("{d}\\n", .{count});`,
    note: "Correct in Zig: arrays and slices expose len, and formatted output takes an argument tuple.",
    startHref: "/zig/basics/hello-and-output/01",
    browseHref: "/zig",
  },
  rust: {
    label: "Rust",
    filename: "count.rs",
    code: `let count = users.len();
println!("{}", count);`,
    note: "Correct in Rust: length is a method call, and println! is a macro.",
    startHref: "/rust/foundations/hello-and-printing/01",
    browseHref: "/rust",
  },
};

const order: TargetId[] = ["go", "zig", "rust"];

export function HomepageDrill() {
  const [selected, setSelected] = createSignal<TargetId>("go");
  const current = () => choices[selected()];

  return (
    <section class="border border-border-default rounded-sm overflow-hidden bg-bg-panel">
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div class="p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-border-default">
          <Stack gap="md">
            <Stack gap="xs">
              <Text tone="muted" size="xs" family="mono">
                Try the translation move
              </Text>
              <Text tone="secondary" size="md">
                Same TypeScript intent. Different target-language reflexes. Pick any answer; all
                three are valid in their own language.
              </Text>
            </Stack>
            <CodeBlock lang="ts" filename="count.ts">{`const count = users.length;
console.log(count);`}</CodeBlock>
            <div
              class="flex flex-row flex-wrap gap-2"
              role="group"
              aria-label="Choose a target language"
            >
              <For each={order}>
                {(id) => (
                  <Button
                    variant={selected() === id ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelected(id)}
                    aria-pressed={selected() === id}
                  >
                    {choices[id].label}
                  </Button>
                )}
              </For>
            </div>
          </Stack>
        </div>
        <div class="p-4 sm:p-6 bg-bg-base/30">
          <Stack gap="md">
            <CodeBlock lang={selected()} filename={current().filename}>
              {current().code}
            </CodeBlock>
            <Text tone="secondary" size="sm">
              {current().note}
            </Text>
            <Stack direction="row" gap="sm" wrap>
              <ButtonLink href={current().startHref} variant="primary" size="md">
                Start {current().label}
              </ButtonLink>
              <ButtonLink href={current().browseHref} variant="secondary" size="md">
                Browse {current().label}
              </ButtonLink>
            </Stack>
          </Stack>
        </div>
      </div>
    </section>
  );
}
