import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Button, ButtonLink, Eyebrow, Heading, StatBlock, Text } from "~/components/ds";
import {
  aggregateModuleProgress,
  findNextUnfinishedExerciseId,
  type ModuleProgressSummary,
  summarizeTheme,
} from "~/lib/progress";
import { tryShare, type ShareOutcome } from "~/lib/try-share";

interface ThemeSummary {
  id: string;
  title: string;
  exerciseIds: string[];
}

interface ModuleCompleteCardProps {
  moduleId: string;
  moduleTitle: string;
  /** 1-indexed position of this module in the curriculum. Used to
   *  honestly frame the celebration ("Module 1 of 7") rather than
   *  letting "MODULE COMPLETE" oversell a single-module milestone.
   *  design-docs/16 F-24. */
  moduleOrder: number;
  /** Total module count in the curriculum. Pairs with moduleOrder
   *  for the "N of M" framing. */
  totalModules: number;
  themes: ThemeSummary[];
  /** Where Continue goes — first exercise of the next module, or
   *  the curriculum index when this was the last module. */
  continueHref: string;
  continueLabel: string;
  /** Pre-composed share text. The card slots the live module title +
   *  exercise count in via simple {placeholder} substitution. */
  shareTemplate: string;
  /** Origin of the deploy (typeover.dev) —
   *  used to build the absolute share URL. */
  siteOrigin: string;
}

/*
 * Module-completion celebration card. design-docs/11 specifies the
 * shape: "typeover · MODULE COMPLETE" header + summary stats +
 * Share / Continue buttons. The share is the v0 growth mechanism
 * per design-docs/07 — quiet word-of-mouth, no marketing.
 *
 * Renders client-only because the progress blob lives in localStorage.
 * The page route already passes `client:only="solid-js"`.
 *
 * State on first load is `null` (haven't checked localStorage yet);
 * after onMount we know either:
 *   - the module is actually complete → celebration view
 *   - the module is partial → "almost there" view with what's left
 *
 * The "almost there" branch matters because the page is reachable
 * by direct URL (a learner could navigate to /go/foundations/complete
 * without finishing any exercises). Showing fake celebration in that
 * case would be deceitful; this branch is the honest path.
 */
export function ModuleCompleteCard(props: ModuleCompleteCardProps) {
  const [progress, setProgress] = createSignal<ModuleProgressSummary | null>(null);
  const [shareState, setShareState] = createSignal<"idle" | "shared" | "copied" | "error">("idle");

  /* Per-theme aggregation delegates to `aggregateModuleProgress` in
   * progress.ts so this card and ProgressChip's tally read the same
   * source of truth. design-docs/20 lens-1 + lens-3 extracted the
   * inline loop into a pure helper for testability. */
  onMount(() => setProgress(aggregateModuleProgress(props.themes)));

  const isComplete = createMemo(() => {
    const p = progress();
    return p !== null && p.exercisesPassed === p.totalExercises && p.totalExercises > 0;
  });

  /* Almost-there branch — Continue CTA points at the first
   * unfinished exercise. design-docs/16 F-8. Pure helper lives in
   * progress.ts. */
  const nextUnfinishedHref = createMemo(() => {
    const exId = findNextUnfinishedExerciseId(props.themes);
    return exId === null ? null : `/${exId}`;
  });

  const shareText = () => {
    const p = progress();
    return props.shareTemplate
      .replace("{moduleTitle}", props.moduleTitle)
      .replace("{themeCount}", String(p?.themesComplete ?? props.themes.length))
      .replace("{exerciseCount}", String(p?.exercisesPassed ?? 0));
  };

  const shareUrl = () => `${props.siteOrigin}/${props.moduleId}/complete`;

  async function share() {
    setShareState(await tryShare(shareText(), shareUrl()));
  }

  /* SSR + hydration-failure fallback. Renders on the server (because
   * the page now passes `client:load`) and stays put if the JS chunk
   * fails to hydrate. Without this the Panel was visibly empty — a
   * learner with a flaky connection landed on a blank congratulations
   * screen. design-docs/19 F-15 + design-docs/16 F-10. */
  return (
    <Show
      when={progress()}
      fallback={
        <div class="flex flex-col gap-4">
          <Eyebrow tone="muted">typeover · module</Eyebrow>
          <Heading level={2} size="2xl">
            {props.moduleTitle}
          </Heading>
          <Text tone="muted" size="sm" family="mono">
            Loading your progress…
          </Text>
          <div>
            <ButtonLink href={props.continueHref} variant="secondary">
              {props.continueLabel}
            </ButtonLink>
          </div>
        </div>
      }
    >
      {(p) => (
        <Show
          when={isComplete()}
          fallback={
            <div class="flex flex-col gap-4">
              <Eyebrow tone="muted">Module — almost there</Eyebrow>
              <Heading level={2} size="2xl">
                {props.moduleTitle}
              </Heading>
              <Text tone="secondary" size="sm">
                You've passed {p().exercisesPassed} of {p().totalExercises} exercises across{" "}
                {p().themesComplete} of {props.themes.length} themes. Come back when the rest are
                done and the celebration screen unlocks.
              </Text>
              <For each={props.themes}>
                {(theme) => {
                  /* Delegate to summarizeTheme so the empty-theme rule
                   * matches everywhere — `0 === 0` would mark a stub
                   * theme complete otherwise. */
                  const summary = summarizeTheme(theme.exerciseIds);
                  return (
                    <div class="flex flex-row gap-3 items-baseline">
                      <span
                        class={
                          "font-mono text-xs " +
                          (summary.themeComplete ? "text-success" : "text-fg-faint")
                        }
                      >
                        {summary.themeComplete ? "✓" : "·"} {summary.passed}/{summary.total}
                      </span>
                      <a
                        href={`/${theme.id}`}
                        class="text-fg-secondary hover:text-fg-primary text-sm transition-colors"
                      >
                        {theme.title}
                      </a>
                    </div>
                  );
                }}
              </For>
              {/* Continue CTA — the celebration branch has one;
               * before this fix the almost-there branch did not,
               * leaving a partial-progress visitor with no path
               * forward. design-docs/16 F-8. */}
              <Show when={nextUnfinishedHref()}>
                {(href) => (
                  <div class="mt-4">
                    <ButtonLink href={href()} variant="primary">
                      Continue where you left off →
                    </ButtonLink>
                  </div>
                )}
              </Show>
            </div>
          }
        >
          <div class="flex flex-col gap-6">
            <Eyebrow tone="primary">
              module {props.moduleOrder} of {props.totalModules} complete
            </Eyebrow>
            <Heading level={2} size="3xl">
              {props.moduleTitle}
            </Heading>
            <div class="flex flex-row gap-6 flex-wrap">
              <StatBlock value={p().themesComplete} label="themes" />
              <StatBlock value={p().exercisesPassed} label="exercises" />
              <Show when={p().hintsUsedTotal > 0}>
                <StatBlock value={p().hintsUsedTotal} label="hints" tone="secondary" />
              </Show>
            </div>
            {/* Share-payload preview — design-docs/16 F-7. People
             * are careful about what they post; the Share button
             * used to fire the OS share sheet without showing the
             * payload first. Now the prose + URL are visible
             * before the click so a cautious user can read them
             * before invoking the share sheet (or the manual-copy
             * fallback). */}
            <div class="border-l-2 border-l-accent-primary/40 pl-3 flex flex-col gap-1">
              <Text tone="muted" size="xs" family="mono">
                will share:
              </Text>
              <Text tone="secondary" size="sm">
                {shareText()}
              </Text>
              <Text tone="faint" size="xs" family="mono">
                {shareUrl()}
              </Text>
            </div>
            <div class="flex flex-row gap-3 flex-wrap">
              <Button variant="primary" onClick={share}>
                Share
              </Button>
              <ButtonLink href={props.continueHref} variant="secondary">
                {props.continueLabel}
              </ButtonLink>
            </div>
            <Show when={shareState() === "copied"}>
              <Text tone="muted" size="xs" family="mono">
                Copied to clipboard — paste anywhere you like.
              </Text>
            </Show>
            <Show when={shareState() === "shared"}>
              <Text tone="muted" size="xs" family="mono">
                Shared. Thanks for telling someone.
              </Text>
            </Show>
            <Show when={shareState() === "error"}>
              <div class="flex flex-col gap-1">
                <Text size="xs" family="mono" class="text-error">
                  Share unavailable. Copy the text + URL above and paste them wherever you like.
                </Text>
              </div>
            </Show>
          </div>
        </Show>
      )}
    </Show>
  );
}
