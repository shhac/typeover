/*
 * SHA-256 helper used by both the browser (in the service worker)
 * and the Vercel Function. Web Crypto is available in both runtimes,
 * so this file has zero Node or browser-only dependencies.
 *
 * Returns lowercase hex — the same form used in the cache URL,
 * `/compile-cache/<lang>/<hash>.wasm`.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const out = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < out.length; i++) {
    hex += out[i].toString(16).padStart(2, "0");
  }
  return hex;
}
