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

export function normalizeRust(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  /* Skip runs of whitespace + line/block comments. Block comments
   * nest in Rust, so we track depth. Returns true if anything was
   * skipped — the caller may need to emit a separator. */
  const skipTrivia = (): boolean => {
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
    return skipped;
  };

  /* Trivia between two identifier characters must collapse to a
   * single space, not vanish. E.g. `let` + line-comment + `x` is
   * `let x`, not `letx`. Inject a separator only when both sides
   * are identifier-y. */
  const maybeEmitSeparator = () => {
    if (
      out.length > 0 &&
      i < n &&
      ID_CHAR.test(out[out.length - 1]) &&
      ID_CHAR.test(src[i])
    ) {
      out += " ";
    }
  };

  while (i < n) {
    if (skipTrivia()) {
      maybeEmitSeparator();
      continue;
    }

    /* Raw string: (b)?r#*"..."#* — must be matched before plain
     * identifier handling would absorb the `r` / `br`. The number
     * of trailing `#`s after the closing `"` must equal the number
     * before the opening `"`. */
    const raw = /^(b?r)(#*)"/.exec(src.slice(i));
    if (raw) {
      const [whole, , hashes] = raw;
      const start = i;
      i += whole.length;
      const close = '"' + hashes;
      const end = src.indexOf(close, i);
      i = end === -1 ? n : end + close.length;
      out += src.slice(start, i);
      continue;
    }

    /* Byte/c-string and byte-char prefixes (`b"`, `b'`, `c"`).
     * Emit the prefix and let the next loop iteration handle the
     * string/char literal that follows. */
    if (
      (src[i] === "b" || src[i] === "c") &&
      (src[i + 1] === '"' || src[i + 1] === "'")
    ) {
      out += src[i++];
      continue;
    }

    /* Plain string literal — copy verbatim, respecting backslash
     * escapes so `\"` doesn't end the literal prematurely. */
    if (src[i] === '"') {
      const start = i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < n) i++;
        i++;
      }
      if (i < n) i++;
      out += src.slice(start, i);
      continue;
    }

    /* Char literal OR lifetime — disambiguate by lookahead. A
     * char literal has the shape `'<one-codepoint>'` (possibly
     * escaped). A lifetime starts with `'` followed by an
     * identifier with no closing quote: `'a`, `'static`, `'_`. */
    if (src[i] === "'") {
      const charLit = /^'(\\u\{[0-9a-fA-F]+\}|\\.|[^'\\\n])'/.exec(
        src.slice(i),
      );
      if (charLit) {
        out += charLit[0];
        i += charLit[0].length;
        continue;
      }
      const lifetime = /^'[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (lifetime) {
        out += lifetime[0];
        i += lifetime[0].length;
        continue;
      }
      out += src[i++];
      continue;
    }

    /* Default: emit verbatim. Multi-char operators (`->`, `=>`,
     * `..=`, `::`, etc.) preserve themselves because we never
     * inject whitespace between non-identifier characters. */
    out += src[i++];
  }

  return out;
}
