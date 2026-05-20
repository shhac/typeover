import { render } from "@solidjs/testing-library";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import {
  Adaptive,
  Badge,
  Button,
  ButtonLink,
  CodeBlock,
  Compare,
  Container,
  Divider,
  Eyebrow,
  Feedback,
  Heading,
  Kbd,
  LangCrumbs,
  MobileKeyBar,
  Panel,
  ProgressChip,
  Stack,
  StatBlock,
  Text,
} from "~/components/ds";
import { HintButton } from "~/components/ds/HintButton";
import { RevealButton } from "~/components/ds/RevealButton";

/*
 * Design-system a11y gate. design-docs/08 commits to WCAG 2.2 AA at
 * the design-system layer: "a page composed entirely of design-system
 * primitives is a11y-correct without further work." This file is the
 * mechanical proof.
 *
 * For each DS primitive (rendered in its most-realistic shape), run
 * axe-core against the JSDOM tree and assert zero violations on the
 * AA-applicable rules. Failures here block launch.
 *
 * What this covers:
 *   - Component-level a11y at the DS layer.
 *   - Token-contrast violations don't surface in JSDOM (axe's colour-
 *     contrast checks need computed background colours which JSDOM
 *     doesn't fully render). The token-level contrast is verified in
 *     comments at src/styles/global.css; a future Playwright pass
 *     will run axe on a real browser to catch what JSDOM can't.
 *
 * What this does NOT cover (future Playwright pass — design-docs/13):
 *   - Computed colour-contrast across themes.
 *   - Flash-of-wrong-theme on first paint.
 *   - Lighthouse Performance score (design-docs/07 launch gate).
 */

/** Configure the axe runner. We pin AA rules + omit the colour-
 *  contrast checks because JSDOM doesn't compute real backgrounds.
 *  Each spec lists `runOnly: { type: "tag", values: [...] }` so a
 *  future axe-core upgrade doesn't quietly add new rule categories
 *  we haven't audited. */
const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  /* JSDOM can't compute the real background colour off CSS custom
   * properties + Tailwind utilities, so axe's colour-contrast check
   * would either false-positive (treating bg as transparent) or
   * false-negative. Disable here; the real-browser run will cover it. */
  rules: { "color-contrast": { enabled: false } },
};

async function runAxe(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, AXE_OPTIONS);
  return results.violations;
}

function describeViolations(violations: axe.Result[]): string {
  return violations
    .map((v) => `[${v.impact ?? "?"}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    .join("\n");
}

describe("design system — a11y (WCAG 2.2 AA, JSDOM)", () => {
  it("Button — primary variant has accessible name", async () => {
    const { container } = render(() => <Button variant="primary">Submit</Button>);
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Button — disabled state", async () => {
    const { container } = render(() => (
      <Button variant="primary" disabled>
        Submit
      </Button>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Badge — TS / GO language chips", async () => {
    const { container } = render(() => (
      <Stack direction="row" gap="sm">
        <Badge variant="ts">TS</Badge>
        <Badge variant="go">GO</Badge>
        <Badge variant="amber">Foundations</Badge>
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("CodeBlock — language + filename header", async () => {
    const { container } = render(() => (
      <CodeBlock lang="go" filename="example.go">
        package main
      </CodeBlock>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Container — wraps content in a centered region", async () => {
    const { container } = render(() => (
      <Container>
        <Heading level={1}>Page title</Heading>
        <Text>Body copy.</Text>
      </Container>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Divider — decorative or semantic", async () => {
    const { container } = render(() => (
      <Stack gap="md">
        <Text>Before</Text>
        <Divider />
        <Text>After</Text>
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Feedback — status region with aria-live", async () => {
    const { container } = render(() => (
      <Feedback status="correct">Correct — and idiomatic.</Feedback>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Heading — h1 through h4", async () => {
    const { container } = render(() => (
      <Stack gap="md">
        <Heading level={1}>Page</Heading>
        <Heading level={2}>Section</Heading>
        <Heading level={3}>Subsection</Heading>
        <Heading level={4}>Subsubsection</Heading>
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("HintButton — initial closed state", async () => {
    const { container } = render(() => (
      <HintButton hints={["one", "two", "three"] as [string, string, string]} />
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Kbd — keyboard key indicator", async () => {
    const { container } = render(() => (
      <Text>
        Press <Kbd>⌘</Kbd> + <Kbd>K</Kbd> to focus search.
      </Text>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("LangCrumbs — language identity row", async () => {
    const { container } = render(() => <LangCrumbs />);
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Panel — bordered container with optional label strip", async () => {
    const { container } = render(() => (
      <Panel padding="default" tone="default">
        <Heading level={3}>Panel title</Heading>
        <Text>Panel body.</Text>
      </Panel>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("RevealButton — show canonical with explanation", async () => {
    const { container } = render(() => <RevealButton canonical="x := 5" lang="go" />);
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Stack — flex layout primitive (no a11y semantics of its own)", async () => {
    const { container } = render(() => (
      <Stack gap="md" direction="row">
        <Text>A</Text>
        <Text>B</Text>
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Text — body text with tone variants", async () => {
    const { container } = render(() => (
      <Stack gap="sm">
        <Text tone="primary">Primary tone.</Text>
        <Text tone="secondary">Secondary tone.</Text>
        <Text tone="muted">Muted tone.</Text>
        <Text tone="faint">Faint tone.</Text>
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Adaptive — split-on-wide / stack-on-narrow primitive", async () => {
    const { container } = render(() => (
      <Adaptive>
        <Text>Left pane</Text>
        <Text>Right pane</Text>
      </Adaptive>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("ButtonLink — anchor styled to match Button", async () => {
    const { container } = render(() => (
      <ButtonLink href="/go" variant="primary">
        Browse curriculum
      </ButtonLink>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Compare — figure/figcaption around side-by-side code", async () => {
    const { container } = render(() => (
      <Compare caption="Same intent, two syntaxes.">
        <CodeBlock lang="ts" filename="a.ts">{`let x = 5;`}</CodeBlock>
        <CodeBlock lang="go" filename="a.go">{`x := 5`}</CodeBlock>
      </Compare>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("Eyebrow — small mono uppercase label", async () => {
    const { container } = render(() => (
      <Stack gap="xs">
        <Eyebrow>default</Eyebrow>
        <Eyebrow tone="amber">amber</Eyebrow>
        <Eyebrow tone="ts">typescript</Eyebrow>
        <Eyebrow tone="go">golang</Eyebrow>
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("MobileKeyBar — Go-symbol bar with role=toolbar", async () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("ProgressChip — both kinds", async () => {
    const { container } = render(() => (
      <Stack gap="xs">
        <ProgressChip kind="theme" passed={6} total={9} />
        <ProgressChip kind="exercise" seen={3} passed={2} />
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });

  it("StatBlock — big number + small label", async () => {
    const { container } = render(() => (
      <Stack direction="row" gap="md">
        <StatBlock value={6} label="themes" />
        <StatBlock value={54} label="exercises" />
        <StatBlock value={12} label="hints" tone="secondary" />
      </Stack>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });
});

describe("composite a11y — typical page chrome", () => {
  /* DS-level coverage above pins individual primitives. These tests
   * pin the combinations real pages use: header chrome + exercise
   * shell + result panel. */

  it("Page header (badges + heading)", async () => {
    const { container } = render(() => (
      <Container>
        <Stack gap="sm">
          <Stack direction="row" gap="sm" align="center" wrap>
            <Badge variant="amber">Foundations</Badge>
            <Text tone="muted" size="sm" family="mono">
              →
            </Text>
            <Badge variant="default" outline>
              Variables and declarations
            </Badge>
          </Stack>
          <Heading level={1}>Variables and declarations</Heading>
        </Stack>
      </Container>
    ));
    const v = await runAxe(container);
    expect(v, describeViolations(v)).toEqual([]);
  });
});
