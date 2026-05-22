/*
 * Multi-language completion sources for CodeMirror.
 *
 * Two mechanics, dispatched by one combined `CompletionSource`:
 *
 *   1. MEMBER-PREFIX DISCOVERY. When the cursor is after a
 *      dotted prefix (`std.`, `std.Io.`, `fmt.`, `strings.`,
 *      `init.`, …), look up the prefix in the language's
 *      member map and offer its members. Hand-curated maps
 *      that cover what the curriculum exercises use today;
 *      grows as new modules ship.
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
 * Per-language map: Zig (`ZIG_MEMBERS`), Go (`GO_MEMBERS`).
 * Both share the same factory + dispatcher; only the dictionary
 * and the keyword blocklist differ.
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

/* ============================ Member maps ============================ */

/**
 * Dotted prefix → member names. Keys are the path string
 * ("std.Io"), values are the names that follow the trailing dot.
 *
 * Members can include METHOD names too, even though we can't tell
 * at the type level which methods belong to which receiver. The
 * scope source picks up method names from the canonical anyway;
 * curating them by namespace just gives the learner a primer
 * before they've seen the method used.
 */
export const ZIG_MEMBERS: Record<string, readonly string[]> = {
  std: [
    "Io",
    "fmt",
    "heap",
    "process",
    "mem",
    "ArrayList",
    "HashMap",
    "AutoHashMap",
    "StringHashMap",
    "debug",
    "testing",
    "math",
    "sort",
    "ascii",
    "unicode",
    "json",
    "fs",
    "os",
    "time",
    "Thread",
  ],
  "std.Io": ["File", "Reader", "Writer"],
  "std.Io.File": ["stdout", "stderr", "stdin"],
  "std.fmt": ["bufPrint", "allocPrint", "format", "parseInt", "parseFloat", "comptimePrint"],
  "std.heap": [
    "page_allocator",
    "smp_allocator",
    "FixedBufferAllocator",
    "ArenaAllocator",
    "DebugAllocator",
    "raw_c_allocator",
    "c_allocator",
  ],
  "std.process": ["Init", "argsAlloc", "argsFree", "exit", "getEnvMap"],
  "std.mem": [
    "Allocator",
    "copyForwards",
    "copyBackwards",
    "eql",
    "indexOf",
    "lastIndexOf",
    "split",
    "splitAny",
    "tokenize",
    "tokenizeAny",
    "trim",
    "trimLeft",
    "trimRight",
    "startsWith",
    "endsWith",
    "replaceScalar",
    "sliceTo",
    "len",
    "zeroes",
  ],
  "std.debug": ["panic", "assert", "print", "dumpStackTrace"],
  "std.testing": [
    "expect",
    "expectEqual",
    "expectError",
    "expectEqualSlices",
    "expectEqualStrings",
    "allocator",
  ],
  "std.math": [
    "min",
    "max",
    "absInt",
    "absCast",
    "pow",
    "sqrt",
    "ceil",
    "floor",
    "round",
    "isNan",
    "isInf",
    "pi",
    "e",
    "maxInt",
    "minInt",
  ],
  "std.sort": ["block", "heap", "insertion", "pdq", "asc", "desc"],
  "std.ascii": ["isAlphabetic", "isDigit", "isAlphanumeric", "isWhitespace", "toLower", "toUpper"],
  "std.fs": ["cwd", "openFileAbsolute", "File", "Dir"],
  "std.fs.File": ["openRead", "create", "close", "read", "write", "readAll", "writeAll"],
  "std.os": ["argv"],
  "std.time": ["timestamp", "nanoTimestamp", "milliTimestamp", "sleep", "ns_per_ms", "ns_per_s"],
  "std.Thread": ["spawn", "join", "Mutex", "Condition"],

  /* The `Init` parameter exposes `io` (the runtime I/O capability).
   * Every exercise that does `init.io` lands here when the learner
   * types `init.`. */
  init: ["io"],
};

/**
 * Go dotted-prefix → members. Covers `fmt`, `strings`, `strconv`,
 * `slices`, `maps`, `errors`, `sort`, `sync`, `time`, `os`, `io`,
 * `bytes`, `regexp`, `bufio` — the stdlib packages the Go
 * curriculum's exercises touch.
 */
export const GO_MEMBERS: Record<string, readonly string[]> = {
  fmt: [
    "Println",
    "Print",
    "Printf",
    "Sprintln",
    "Sprint",
    "Sprintf",
    "Errorf",
    "Fprintln",
    "Fprint",
    "Fprintf",
    "Scan",
    "Scanln",
    "Scanf",
  ],
  strings: [
    "Contains",
    "ContainsAny",
    "HasPrefix",
    "HasSuffix",
    "Index",
    "LastIndex",
    "Join",
    "Split",
    "SplitN",
    "Replace",
    "ReplaceAll",
    "ToLower",
    "ToUpper",
    "ToTitle",
    "TrimSpace",
    "Trim",
    "TrimLeft",
    "TrimRight",
    "TrimPrefix",
    "TrimSuffix",
    "Repeat",
    "Count",
    "EqualFold",
    "Fields",
    "Builder",
    "NewReader",
    "NewReplacer",
    "Map",
    "Cut",
  ],
  strconv: [
    "Atoi",
    "Itoa",
    "ParseInt",
    "ParseFloat",
    "ParseBool",
    "FormatInt",
    "FormatFloat",
    "FormatBool",
    "Quote",
    "Unquote",
  ],
  slices: [
    "Contains",
    "ContainsFunc",
    "Index",
    "IndexFunc",
    "Sort",
    "SortFunc",
    "SortStableFunc",
    "Reverse",
    "Equal",
    "EqualFunc",
    "Compact",
    "Delete",
    "DeleteFunc",
    "Insert",
    "Concat",
    "Clone",
    "Min",
    "Max",
    "BinarySearch",
  ],
  maps: ["Keys", "Values", "Equal", "EqualFunc", "Copy", "Clone", "DeleteFunc"],
  errors: ["New", "Is", "As", "Unwrap", "Join"],
  sort: [
    "Slice",
    "SliceStable",
    "Ints",
    "Strings",
    "Float64s",
    "Sort",
    "Stable",
    "Search",
    "SearchInts",
    "SearchStrings",
    "Reverse",
  ],
  sync: ["Mutex", "RWMutex", "WaitGroup", "Once", "Map", "Cond", "Pool"],
  time: [
    "Now",
    "Sleep",
    "Since",
    "Until",
    "Date",
    "Parse",
    "Duration",
    "Second",
    "Millisecond",
    "Microsecond",
    "Nanosecond",
    "Minute",
    "Hour",
    "Time",
    "After",
    "Tick",
  ],
  os: [
    "Args",
    "Getenv",
    "Setenv",
    "Exit",
    "Stdout",
    "Stderr",
    "Stdin",
    "Open",
    "Create",
    "ReadFile",
    "WriteFile",
    "Getwd",
  ],
  io: ["Copy", "EOF", "Reader", "Writer", "Closer", "ReadAll"],
  bytes: [
    "Buffer",
    "Equal",
    "Contains",
    "Index",
    "Split",
    "Join",
    "ToLower",
    "ToUpper",
    "NewReader",
  ],
  regexp: ["Compile", "MustCompile", "MatchString", "Match"],
  bufio: ["NewReader", "NewWriter", "NewScanner", "Scanner"],

  /* Common builder / buffer types' methods. */
  "strings.Builder": ["WriteString", "WriteByte", "WriteRune", "String", "Len", "Reset"],
  "bytes.Buffer": ["WriteString", "Write", "WriteByte", "String", "Bytes", "Len", "Reset", "Read"],
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

/* Per-language keyword blocklist for the scope source. Keywords
 * are still typed manually; the language grammar highlights them;
 * offering them in the dropdown would just be noise. */
const ZIG_BLOCKLIST: ReadonlySet<string> = new Set([
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

const GO_BLOCKLIST: ReadonlySet<string> = new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
  "true",
  "false",
  "nil",
  "iota",
]);

export type CompletionLanguage = "zig" | "go";

const MEMBERS_BY_LANG: Record<CompletionLanguage, Record<string, readonly string[]>> = {
  zig: ZIG_MEMBERS,
  go: GO_MEMBERS,
};

const BLOCKLIST_BY_LANG: Record<CompletionLanguage, ReadonlySet<string>> = {
  zig: ZIG_BLOCKLIST,
  go: GO_BLOCKLIST,
};

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
    /* === Member-prefix branch === */
    const memberMatch = context.matchBefore(DOTTED_PREFIX_RE);
    if (memberMatch) {
      const text = memberMatch.text;
      const lastDot = text.lastIndexOf(".");
      const prefix = text.slice(0, lastDot);
      const partial = text.slice(lastDot + 1);
      const ms = members[prefix];
      if (ms) {
        return {
          from: memberMatch.from + lastDot + 1,
          options: ms.map((m) => ({ label: m, type: "property" })),
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

/* Back-compat thin wrappers so existing call sites that imported
 * the Zig-named helpers keep working without threading the
 * `language: "zig"` arg through. */
export function makeZigCompletionSource(
  options: Omit<CompletionOptions, "language"> = {},
): CompletionSource {
  return makeCompletionSource({ ...options, language: "zig" });
}

export function zigCompletionExtension(
  options: Omit<CompletionOptions, "language"> = {},
): Extension {
  return completionExtension({ ...options, language: "zig" });
}
