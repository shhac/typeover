/*
 * Zig-specific completion sources for CodeMirror.
 *
 * Two mechanics, dispatched by one combined `CompletionSource`:
 *
 *   1. MEMBER-PREFIX DISCOVERY. When the cursor is after a
 *      dotted prefix (`std.`, `std.Io.`, `init.`, …), look up
 *      the prefix in `ZIG_MEMBERS` and offer its members.
 *      Hand-curated map, covers what the curriculum exercises
 *      use today. New entries get added as Module 5–7 lands.
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
 * Both mechanics surface via CodeMirror's dropdown (per
 * design decision 2026-05-22 — Tab on the dropdown is the
 * learner's choice, not auto-accept). Tab without an active
 * completion still inserts a tab character via `indentWithTab`
 * because the autocomplete extension only consumes Tab when
 * the dropdown is open.
 *
 * Design note: completions don't include exercise-specific
 * answer SEQUENCES — only individual identifiers. Picking
 * `stdout` from the dropdown doesn't write
 * `std.Io.File.stdout()`; the learner still assembles the
 * call chain by typing each segment. That preserves the
 * exercise's pedagogy.
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

/* ============================ Member map ============================ */

/* Dotted prefix → member names. Keys are the path string ("std.Io"),
 * values are the names that follow the trailing dot. */
export const ZIG_MEMBERS: Record<string, readonly string[]> = {
  std: ["Io", "fmt", "heap", "process", "mem", "ArrayList", "debug", "testing"],
  "std.Io": ["File", "Reader", "Writer"],
  "std.Io.File": ["stdout", "stderr", "stdin"],
  "std.fmt": ["bufPrint", "allocPrint", "format"],
  "std.heap": ["page_allocator", "FixedBufferAllocator", "ArenaAllocator"],
  "std.process": ["Init"],
  "std.mem": ["Allocator"],
  "std.debug": ["panic"],
  "std.testing": ["expect", "expectEqual"],

  /* The Init parameter exposes `io` (the runtime I/O capability).
   * Every exercise that does `init.io` lands here when the learner
   * types `init.`. */
  init: ["io"],
};

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

/* ========================== Source factory ========================= */

/* Regex for a complete dotted-prefix expression ending at the
 * cursor. Matches `std.`, `std.Io.`, `std.Io.F`, `init.io`, etc.
 * The trailing `[a-zA-Z_]?\w*` captures both "right after the dot"
 * (empty) and "partway through typing a member name". */
const DOTTED_PREFIX_RE = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\.[A-Za-z_]?\w*/;

/* Plain identifier prefix (no leading dot). */
const PLAIN_IDENT_RE = /[A-Za-z_]\w*/;

/* Tokens we never want to suggest as scope completions even if they
 * appear in a scaffold/canonical. (Keywords are still typed
 * manually; the lezer-zig grammar highlights them; offering them in
 * the dropdown would just be noise.) */
const SCOPE_BLOCKLIST: ReadonlySet<string> = new Set([
  "const",
  "var",
  "fn",
  "pub",
  "return",
  "if",
  "else",
  "while",
  "for",
  "switch",
  "try",
  "catch",
  "defer",
  "errdefer",
  "orelse",
  "and",
  "or",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "comptime",
  "inline",
  "unreachable",
  "error",
  "struct",
  "enum",
  "union",
  "test",
]);

interface ZigCompletionOptions {
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
export function makeZigCompletionSource(options: ZigCompletionOptions = {}): CompletionSource {
  const seedIds = new Set<string>([
    ...extractIdentifiers(options.scaffold),
    ...extractIdentifiers(options.canonical),
  ]);
  for (const kw of SCOPE_BLOCKLIST) seedIds.delete(kw);

  return (context: CompletionContext): CompletionResult | null => {
    /* === Member-prefix branch === */
    const memberMatch = context.matchBefore(DOTTED_PREFIX_RE);
    if (memberMatch) {
      const text = memberMatch.text;
      const lastDot = text.lastIndexOf(".");
      const prefix = text.slice(0, lastDot);
      const partial = text.slice(lastDot + 1);
      const members = ZIG_MEMBERS[prefix];
      if (members) {
        return {
          from: memberMatch.from + lastDot + 1,
          options: members.map((m) => ({ label: m, type: "property" })),
          validFor: /^\w*$/,
        };
      }
      /* Known dotted-shape but unknown root (e.g. learner's local
       * `nums.append`): suppress completion rather than spilling
       * scope identifiers after a dot, which would be confusing. */
      if (partial.length === 0 && !context.explicit) return null;
      /* On explicit trigger (Ctrl+Space) with partial typing, fall
       * through to scope so the learner isn't stranded. */
    }

    /* === Scope branch === */
    const wordMatch = context.matchBefore(PLAIN_IDENT_RE);
    if (!wordMatch) return null;
    /* Skip empty matches unless the trigger was explicit — don't
     * pop the dropdown the instant the user types a space. */
    if (wordMatch.from === wordMatch.to && !context.explicit) return null;

    const bufferIds = extractIdentifiers(context.state.doc.toString());
    const all = new Set<string>(seedIds);
    for (const id of bufferIds) all.add(id);
    for (const kw of SCOPE_BLOCKLIST) all.delete(kw);
    /* Don't suggest the exact prefix the learner just typed —
     * accepting it would no-op. CodeMirror filters by `validFor`
     * anyway, but we drop the exact match for tidiness. */
    all.delete(wordMatch.text);

    if (all.size === 0) return null;

    return {
      from: wordMatch.from,
      options: [...all].sort().map((id) => ({ label: id, type: "variable" })),
      validFor: /^\w*$/,
    };
  };
}

/* Wrap as a configured `autocompletion()` extension. The override
 * array gives our source priority — and exclusivity, since we
 * return early when we're confident no completion should fire (e.g.
 * member-shape with unknown root). */
export function zigCompletionExtension(options: ZigCompletionOptions = {}): Extension {
  return autocompletion({
    override: [makeZigCompletionSource(options)],
    activateOnTyping: true,
    /* The default `defaultKeymap: true` includes Tab to accept the
     * highlighted completion. Per the design (the dropdown is its
     * own pedagogy moment), we leave Tab for `indentWithTab` to
     * handle when no dropdown is active — CodeMirror automatically
     * sequences the Tab handlers, so closeBrackets/dropdown gets
     * first shot, then indentWithTab. */
  });
}
