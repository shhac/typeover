/*
 * Zig dotted-prefix → member names.
 *
 * Keys are the path string ("std.Io"), values are the names that
 * follow the trailing dot. Hand-curated; covers what the Zig
 * curriculum's exercises use today, grows as new modules ship.
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

/* Keywords we never want to suggest as scope completions even if
 * they appear in a scaffold/canonical. The language grammar
 * highlights them; offering them in the dropdown would just be
 * noise. */
export const ZIG_BLOCKLIST: ReadonlySet<string> = new Set([
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
