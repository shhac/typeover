import { createSignal } from "solid-js";
import { ButtonLink, CodeBlock, Heading, Stack, Text } from "~/components/ds";

type TargetId = "go" | "zig" | "rust";

const choices: Record<
  TargetId,
  {
    label: string;
    filename: string;
    lang: "go" | "zig" | "rust";
    code: string;
    note: string;
    startHref: string;
    browseHref: string;
  }
> = {
  go: {
    label: "Go",
    filename: "count.go",
    lang: "go",
    code: `count := len(users)
fmt.Println(count)`,
    note: "Correct in Go: length is a builtin function, and printing goes through fmt.",
    startHref: "/go/foundations/variables/01",
    browseHref: "/go",
  },
  zig: {
    label: "Zig",
    filename: "count.zig",
    lang: "zig",
    code: `const count = users.len;
std.debug.print("{d}\\n", .{count});`,
    note: "Correct in Zig: arrays and slices expose len, and formatted output takes an argument tuple.",
    startHref: "/zig/basics/hello-and-output/01",
    browseHref: "/zig",
  },
  rust: {
    label: "Rust",
    filename: "count.rs",
    lang: "rust",
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
    <section>
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 lg:gap-10 items-start">
        <div>
          <Stack gap="md">
            <Stack gap="xs">
              <Heading level={2} size="2xl">
                One TypeScript idea, three correct translations
              </Heading>
              <Text tone="secondary" size="md">
                Same TypeScript intent. Different target-language reflexes. Pick any answer; all
                three are valid in their own language.
              </Text>
            </Stack>
            <CodeBlock lang="ts" filename="count.ts">{`const count = users.length;
console.log(count);`}</CodeBlock>
          </Stack>
        </div>
        <div>
          <Stack gap="md">
            <CodeBlock
              lang={current().lang}
              filename={current().filename}
              tabs={order.map((id) => ({
                id,
                label: choices[id].filename,
                lang: choices[id].lang,
                selected: selected() === id,
                onSelect: () => setSelected(id),
              }))}
            >
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
