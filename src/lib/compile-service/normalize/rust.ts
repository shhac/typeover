/*
 * Whitespace + comment normalizer for Rust source.
 *
 * The cache key for /api/compile/rust is sha256(normalizeRust(source)).
 * Two sources that normalize to the same string compile to
 * byte-identical wasm under `rustc -C strip=symbols`. Design rationale
 * + the rejected alternatives (server rustfmt, rustfmt-wasm) live in
 * design-docs/32.
 *
 * Runs identically in the browser (service worker) and in the
 * Vercel Function. Keep this pure: no Node or browser APIs.
 */

const ID_CHAR = /[A-Za-z0-9_]/;

interface ReadResult {
  text: string;
  next: number;
}

function skipTrivia(src: string, start: number): { skipped: boolean; next: number } {
  let i = start;
  const n = src.length;
  let skipped = false;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      skipped = true;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      skipped = true;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      let depth = 1;
      while (i < n && depth > 0) {
        if (src[i] === "/" && src[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (src[i] === "*" && src[i + 1] === "/") {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      skipped = true;
      continue;
    }
    break;
  }
  return { skipped, next: i };
}

function readRawString(src: string, start: number): ReadResult | null {
  const raw = /^(b?r)(#*)"/.exec(src.slice(start));
  if (!raw) return null;
  const [whole, , hashes] = raw;
  let next = start + whole.length;
  const close = '"' + hashes;
  const end = src.indexOf(close, next);
  next = end === -1 ? src.length : end + close.length;
  return { text: src.slice(start, next), next };
}

function readStringLiteral(src: string, start: number): ReadResult | null {
  if (src[start] !== '"') return null;
  let next = start + 1;
  while (next < src.length && src[next] !== '"') {
    if (src[next] === "\\" && next + 1 < src.length) next++;
    next++;
  }
  if (next < src.length) next++;
  return { text: src.slice(start, next), next };
}

function readCharOrLifetime(src: string, start: number): ReadResult | null {
  if (src[start] !== "'") return null;
  const charLit = /^'(\\u\{[0-9a-fA-F]+\}|\\.|[^'\\\n])'/.exec(src.slice(start));
  if (charLit) return { text: charLit[0], next: start + charLit[0].length };
  const lifetime = /^'[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(start));
  if (lifetime) return { text: lifetime[0], next: start + lifetime[0].length };
  return { text: src[start]!, next: start + 1 };
}

export function normalizeRust(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  /* Trivia between two identifier characters must collapse to a
   * single space, not vanish. E.g. `let` + line-comment + `x` is
   * `let x`, not `letx`. Inject a separator only when both sides
   * are identifier-y. */
  const maybeEmitSeparator = () => {
    if (out.length > 0 && i < n && ID_CHAR.test(out[out.length - 1]) && ID_CHAR.test(src[i])) {
      out += " ";
    }
  };

  while (i < n) {
    const trivia = skipTrivia(src, i);
    if (trivia.skipped) {
      i = trivia.next;
      maybeEmitSeparator();
      continue;
    }

    /* Raw string: (b)?r#*"..."#* — must be matched before plain
     * identifier handling would absorb the `r` / `br`. The number
     * of trailing `#`s after the closing `"` must equal the number
     * before the opening `"`. */
    const raw = readRawString(src, i);
    if (raw) {
      out += raw.text;
      i = raw.next;
      continue;
    }

    /* Byte/c-string and byte-char prefixes (`b"`, `b'`, `c"`).
     * Emit the prefix and let the next loop iteration handle the
     * string/char literal that follows. */
    if ((src[i] === "b" || src[i] === "c") && (src[i + 1] === '"' || src[i + 1] === "'")) {
      out += src[i++];
      continue;
    }

    /* Plain string literal — copy verbatim, respecting backslash
     * escapes so `\"` doesn't end the literal prematurely. */
    const stringLiteral = readStringLiteral(src, i);
    if (stringLiteral) {
      out += stringLiteral.text;
      i = stringLiteral.next;
      continue;
    }

    /* Char literal OR lifetime — disambiguate by lookahead. A
     * char literal has the shape `'<one-codepoint>'` (possibly
     * escaped). A lifetime starts with `'` followed by an
     * identifier with no closing quote: `'a`, `'static`, `'_`. */
    const charOrLifetime = readCharOrLifetime(src, i);
    if (charOrLifetime) {
      out += charOrLifetime.text;
      i = charOrLifetime.next;
      continue;
    }

    /* Default: emit verbatim. Multi-char operators (`->`, `=>`,
     * `..=`, `::`, etc.) preserve themselves because we never
     * inject whitespace between non-identifier characters. */
    out += src[i++];
  }

  return out;
}
