/*
 * Multi-language completion sources for CodeMirror.
 *
 * Two mechanics, dispatched by one combined `CompletionSource`:
 *
 *   1. MEMBER-PREFIX DISCOVERY. When the cursor is after a
 *      dotted prefix (`std.`, `std.Io.`, `fmt.`, `strings.`,
 *      `init.`, …), look up the prefix in the language's
 *      member map and offer its members.
 *
 *   2. IN-SCOPE TOKEN COMPLETION. When the cursor is at the
 *      end of a plain identifier (no leading `.`), suggest any
 *      identifier already visible in the editor's buffer OR in
 *      the exercise's scaffold/canonical strings. Tokenization
 *      bounds on non-`[\w]` characters — `std.Io.File` is
 *      three tokens, not one. The scaffold-seed lets the
 *      learner reach for identifiers they've SEEN (in the
 *      hints, prompts, prior canonicals) but haven't yet
 *      TYPED in the current editor.
 *
 * Both mechanics surface via CodeMirror's dropdown. Tab on the
 * dropdown is the learner's choice — accepting the highlighted
 * completion is its own pedagogy moment. Tab WITHOUT an active
 * dropdown still inserts a tab character because the
 * autocomplete extension only consumes Tab when the menu is
 * open.
 *
 * Design note: completions surface individual identifiers, not
 * exercise-specific answer SEQUENCES. Picking `stdout` from the
 * dropdown doesn't write `std.Io.File.stdout()`; the learner
 * still assembles the call chain segment-by-segment. That
 * preserves the exercise's pedagogy.
 *
 * Per-language data lives in `members-zig.ts` / `members-go.ts`;
 * this file is the language-agnostic engine + factory.
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { ZIG_MEMBERS, ZIG_BLOCKLIST } from "./members-zig";
import { GO_MEMBERS, GO_BLOCKLIST } from "./members-go";

/* Re-export the per-language tables so callers that want to
 * inspect or test them don't need to know which file owns them. */
export { ZIG_MEMBERS, GO_MEMBERS };

/* ====================== Identifier extraction ====================== */

/* Pull every `[A-Za-z_][\w]*` token out of a source string. Used to
 * seed the in-scope completer with names the exercise has shown
 * but the learner may not have typed yet.
 *
 * The leading `\b` ensures we start at a word boundary — without it,
 * `0xff` would tokenize as `xff` because the engine scans every
 * position and finds `x` matches `[A-Za-z_]`. With `\b`, we only
 * start matches where the preceding character is NOT a word char
 * (or at start-of-string). */
const IDENTIFIER_RE = /\b[A-Za-z_][A-Za-z0-9_]*/g;

export function extractIdentifiers(source: string | undefined | null): string[] {
  if (!source) return [];
  return [...source.matchAll(IDENTIFIER_RE)].map((m) => m[0]);
}

/* ========================== Language registry ====================== */

export type CompletionLanguage = "zig" | "go";

const MEMBERS_BY_LANG: Record<CompletionLanguage, Record<string, readonly string[]>> = {
  zig: ZIG_MEMBERS,
  go: GO_MEMBERS,
};

const BLOCKLIST_BY_LANG: Record<CompletionLanguage, ReadonlySet<string>> = {
  zig: ZIG_BLOCKLIST,
  go: GO_BLOCKLIST,
};

/* ========================== Branch matchers ======================== */

/* Regex for a complete dotted-prefix expression ending at the
 * cursor. Matches `std.`, `std.Io.`, `std.Io.F`, `init.io`, etc.
 * The trailing `[a-zA-Z_]?\w*` captures both "right after the dot"
 * (empty) and "partway through typing a member name". */
const DOTTED_PREFIX_RE = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\.[A-Za-z_]?\w*/;

/* Plain identifier prefix (no leading dot). */
const PLAIN_IDENT_RE = /[A-Za-z_]\w*/;

/* Sentinel return from the member branch meaning "no member match,
 * but caller may fall through to scope" — distinct from `null`
 * (which suppresses the source entirely). Mirrors the C1 design:
 * "explicit dotted-prefix context with unknown root + non-explicit
 * trigger → suppress; same context + explicit trigger → fall
 * through". */
const FALLTHROUGH = Symbol("fallthrough");
type MemberResult = CompletionResult | typeof FALLTHROUGH | null;

/* Try the member-prefix branch. Returns:
 *  - CompletionResult: known dotted root, members surfaced
 *  - null: dotted-prefix context with unknown root +
 *    non-explicit trigger (suppress entirely — don't spill
 *    scope tokens after a dot)
 *  - FALLTHROUGH: not in a dotted-prefix context, OR unknown
 *    root + explicit trigger; caller should fall through to
 *    scope completion */
export function tryMemberCompletion(
  context: CompletionContext,
  members: Record<string, readonly string[]>,
): MemberResult {
  const match = context.matchBefore(DOTTED_PREFIX_RE);
  if (!match) return FALLTHROUGH;
  const text = match.text;
  const lastDot = text.lastIndexOf(".");
  const prefix = text.slice(0, lastDot);
  const partial = text.slice(lastDot + 1);
  const ms = members[prefix];
  if (ms) {
    return {
      from: match.from + lastDot + 1,
      options: ms.map((m) => ({ label: m, type: "property" })),
      validFor: /^\w*$/,
    };
  }
  /* Known dotted-shape but unknown root (e.g. learner's local
   * `nums.append`): suppress when the trigger wasn't explicit so
   * we don't spill scope tokens after a dot. On Ctrl+Space with
   * partial typing, fall through to scope so the learner isn't
   * stranded. */
  if (partial.length === 0 && !context.explicit) return null;
  return FALLTHROUGH;
}

/* Try the in-scope branch. Returns either a CompletionResult or
 * null. Pure-ish: depends on the doc text + the configured seed
 * and blocklist. */
export function tryScopeCompletion(
  context: CompletionContext,
  seedIds: ReadonlySet<string>,
  blocklist: ReadonlySet<string>,
): CompletionResult | null {
  const wordMatch = context.matchBefore(PLAIN_IDENT_RE);
  if (!wordMatch) return null;
  /* Skip empty matches unless the trigger was explicit — don't
   * pop the dropdown the instant the user types a space. */
  if (wordMatch.from === wordMatch.to && !context.explicit) return null;

  const bufferIds = extractIdentifiers(context.state.doc.toString());
  const all = new Set<string>(seedIds);
  for (const id of bufferIds) all.add(id);
  for (const kw of blocklist) all.delete(kw);
  /* Don't suggest the exact prefix the learner just typed —
   * accepting it would no-op. */
  all.delete(wordMatch.text);

  if (all.size === 0) return null;

  return {
    from: wordMatch.from,
    options: [...all].sort().map((id) => ({ label: id, type: "variable" })),
    validFor: /^\w*$/,
  };
}

/* ========================== Source factory ========================= */

interface CompletionOptions {
  /** Language pack to use for member discovery + keyword filtering. */
  language: CompletionLanguage;
  /** Scaffold (read-only surrounding code, if any). Identifiers
   *  extracted on configuration; cheap to extract once. */
  scaffold?: string;
  /** Reference answer. Same treatment — extract identifiers, seed
   *  the scope source. The learner still has to assemble names
   *  into expressions; surfacing the names isn't giving the
   *  answer away. */
  canonical?: string;
}

/* Build the combined completion source. Captures scaffold + canonical
 * identifiers at configuration time (once per editor mount), then
 * augments with the live buffer on every keystroke. */
export function makeCompletionSource(options: CompletionOptions): CompletionSource {
  const members = MEMBERS_BY_LANG[options.language];
  const blocklist = BLOCKLIST_BY_LANG[options.language];

  const seedIds = new Set<string>([
    ...extractIdentifiers(options.scaffold),
    ...extractIdentifiers(options.canonical),
  ]);
  for (const kw of blocklist) seedIds.delete(kw);

  return (context: CompletionContext): CompletionResult | null => {
    const memberResult = tryMemberCompletion(context, members);
    if (memberResult === null) return null;
    if (memberResult !== FALLTHROUGH) return memberResult;
    return tryScopeCompletion(context, seedIds, blocklist);
  };
}

/* Wrap as a configured `autocompletion()` extension. The override
 * array gives our source priority — and exclusivity, since we
 * return early when we're confident no completion should fire
 * (e.g. member-shape with unknown root). */
export function completionExtension(options: CompletionOptions): Extension {
  return autocompletion({
    override: [makeCompletionSource(options)],
    activateOnTyping: true,
  });
}
