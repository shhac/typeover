import { createMemo, createSignal, For, onMount, Show } from "solid-js";
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
    } catch {
      /* User cancelled the share sheet, or clipboard write was
       * denied. Both are benign — reset to idle. */
      setShareState("idle");
    }
  }

  return (
    <Show
      when={progress()}
      fallback={<div class="text-fg-faint text-sm font-mono">Loading your progress…</div>}
    >
      {(p) => (
        <Show
          when={isComplete()}
          fallback={
            <div class="flex flex-col gap-4">
              <div class="font-mono text-xs uppercase tracking-widest text-fg-muted">
                Module — Almost there
              </div>
              <div class="text-fg-primary text-2xl font-semibold tracking-tight">
                {props.moduleTitle}
              </div>
              <div class="text-fg-secondary text-sm">
                You've passed {p().exercisesPassed} of {p().totalExercises} exercises across{" "}
                {p().themesComplete} of {props.themes.length} themes. Come back when the rest are
                done and the celebration screen unlocks.
              </div>
              <For each={props.themes}>
                {(theme) => {
                  const themePassed = theme.exerciseIds.filter(
                    (id) => getExerciseProgress(id).instancesPassed > 0,
                  ).length;
                  const isThemeComplete = themePassed === theme.exerciseIds.length;
                  return (
                    <div class="flex flex-row gap-3 items-baseline">
                      <span
                        class={
                          "font-mono text-xs " +
                          (isThemeComplete ? "text-success" : "text-fg-faint")
                        }
                      >
                        {isThemeComplete ? "✓" : "·"} {themePassed}/{theme.exerciseIds.length}
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
            </div>
          }
        >
          <div class="flex flex-col gap-6">
            <div class="font-mono text-xs uppercase tracking-widest text-accent-amber">
              typeover · MODULE COMPLETE
            </div>
            <div class="text-fg-primary text-3xl font-semibold tracking-tight">
              {props.moduleTitle}
            </div>
            <div class="flex flex-row gap-6 flex-wrap">
              <div class="flex flex-col">
                <div class="text-accent-amber text-3xl font-mono">{p().themesComplete}</div>
                <div class="text-fg-faint text-xs font-mono uppercase tracking-widest">themes</div>
              </div>
              <div class="flex flex-col">
                <div class="text-accent-amber text-3xl font-mono">{p().exercisesPassed}</div>
                <div class="text-fg-faint text-xs font-mono uppercase tracking-widest">
                  exercises
                </div>
              </div>
              <Show when={p().hintsUsedTotal > 0}>
                <div class="flex flex-col">
                  <div class="text-fg-secondary text-3xl font-mono">{p().hintsUsedTotal}</div>
                  <div class="text-fg-faint text-xs font-mono uppercase tracking-widest">hints</div>
                </div>
              </Show>
            </div>
            <div class="flex flex-row gap-3 flex-wrap">
              <button
                type="button"
                onClick={share}
                class="inline-flex items-center justify-center h-11 px-4 rounded-sm text-sm font-sans font-medium bg-accent-amber text-bg-base hover:bg-accent-amber/90 border border-accent-amber transition-colors"
              >
                Share
              </button>
              <a
                href={props.continueHref}
                class="inline-flex items-center justify-center h-11 px-4 rounded-sm text-sm font-sans font-medium bg-bg-elevated text-fg-primary border border-border-strong hover:border-accent-amber/60 hover:text-accent-amber transition-colors"
              >
                {props.continueLabel}
              </a>
            </div>
            <Show when={shareState() === "copied"}>
              <div class="text-fg-muted text-xs font-mono">
                Copied to clipboard — paste anywhere you like.
              </div>
            </Show>
            <Show when={shareState() === "shared"}>
              <div class="text-fg-muted text-xs font-mono">Shared. Thanks for telling someone.</div>
            </Show>
            <Show when={shareState() === "error"}>
              <div class="text-error text-xs font-mono">
                Share unavailable. Copy this and paste it manually:{" "}
                <code class="text-fg-primary">{shareText()}</code>
              </div>
            </Show>
          </div>
        </Show>
      )}
    </Show>
  );
}
