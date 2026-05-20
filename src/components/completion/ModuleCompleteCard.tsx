import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Button, ButtonLink, Eyebrow, Heading, StatBlock, Text } from "~/components/ds";
import { getExerciseProgress, summarizeTheme } from "~/lib/progress";

interface ThemeSummary {
  id: string;
  title: string;
  exerciseIds: string[];
}

interface ModuleCompleteCardProps {
  moduleId: string;
  moduleTitle: string;
  themes: ThemeSummary[];
  /** Where Continue goes — first exercise of the next module, or
   *  the curriculum index when this was the last module. */
  continueHref: string;
  continueLabel: string;
  /** Pre-composed share text. The card slots the live module title +
   *  exercise count in via simple {placeholder} substitution. */
  shareTemplate: string;
  /** Origin of the deploy (typeover.paulie.app / typeover.dev) —
   *  used to build the absolute share URL. */
  siteOrigin: string;
}

interface RealProgress {
  exercisesPassed: number;
  totalExercises: number;
  themesComplete: number;
  hintsUsedTotal: number;
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
  const [progress, setProgress] = createSignal<RealProgress | null>(null);
  const [shareState, setShareState] = createSignal<"idle" | "shared" | "copied" | "error">("idle");

  onMount(() => {
    let passed = 0;
    let total = 0;
    let themesComplete = 0;
    let hints = 0;
    /* Per-theme aggregation delegates the "all exercises passed?"
     * predicate to summarizeTheme so this card and ProgressChip's
     * theme-overview tally read the same source of truth. The hint
     * total is collected here because the helper doesn't carry
     * hint stats (a chip never displays them). */
    for (const theme of props.themes) {
      const summary = summarizeTheme(theme.exerciseIds);
      passed += summary.passed;
      total += summary.total;
      if (summary.themeComplete) themesComplete++;
      for (const id of theme.exerciseIds) {
        hints += getExerciseProgress(id).hintsUsedTotal;
      }
    }
    setProgress({
      exercisesPassed: passed,
      totalExercises: total,
      themesComplete,
      hintsUsedTotal: hints,
    });
  });

  const isComplete = createMemo(() => {
    const p = progress();
    return p !== null && p.exercisesPassed === p.totalExercises && p.totalExercises > 0;
  });

  /* For the almost-there branch — find the first exercise the
   * learner hasn't passed yet, so the page has a Continue CTA
   * pointing at it. Without this, a partial-progress visitor
   * (direct-link or stale share) sees what's left but no path
   * forward. design-docs/16 F-8. */
  const nextUnfinishedHref = createMemo(() => {
    for (const theme of props.themes) {
      for (const exId of theme.exerciseIds) {
        const slot = getExerciseProgress(exId);
        if (slot.instancesPassed === 0) return `/go/${exId}`;
      }
    }
    return null;
  });

  const shareText = () => {
    const p = progress();
    return props.shareTemplate
      .replace("{moduleTitle}", props.moduleTitle)
      .replace("{themeCount}", String(p?.themesComplete ?? props.themes.length))
      .replace("{exerciseCount}", String(p?.exercisesPassed ?? 0));
  };

  const shareUrl = () => `${props.siteOrigin}/go/${props.moduleId}/complete`;

  async function share() {
    const text = shareText();
    const url = shareUrl();
    if (typeof navigator === "undefined") {
      setShareState("error");
      return;
    }
    /* lib.dom declares `share` and `clipboard` as required on
     * Navigator, so an `"x" in nav` guard narrows the false branch
     * to `never`. Treat the live object as Partial<Navigator> — on
     * non-supporting browsers either property may genuinely be
     * undefined at runtime. */
    const nav: Partial<Navigator> = navigator;
    try {
      if (nav.share) {
        await nav.share({ title: "typeover", text, url });
        setShareState("shared");
        return;
      }
      if (nav.clipboard) {
        await nav.clipboard.writeText(`${text}\n${url}`);
        setShareState("copied");
        return;
      }
      setShareState("error");
    } catch (e) {
      /* User cancelled the share sheet vs permission denied vs
       * crashed share-sheet are three different cases. AbortError
       * is the cancellation signal per the Web Share spec —
       * benign, reset to idle. Anything else is a real failure;
       * fall back to the manual-copy panel. design-docs/19 F-5. */
      const isCancellation = e instanceof DOMException && e.name === "AbortError";
      setShareState(isCancellation ? "idle" : "error");
    }
  }

  return (
    <Show
      when={progress()}
      fallback={
        <Text tone="faint" size="sm" family="mono">
          Loading your progress…
        </Text>
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
                        href={`/go/${theme.id}`}
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
            <Eyebrow tone="amber">typeover · module complete</Eyebrow>
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
            <div class="border-l-2 border-l-accent-amber/40 pl-3 flex flex-col gap-1">
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
