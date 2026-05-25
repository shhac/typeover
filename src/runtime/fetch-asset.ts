/*
 * Shared helper for fetching runtime assets (wasm modules, compiler
 * archives, stdlib tarballs) from the origin's static-asset path.
 *
 * Three asset-loaders in zig-compile + the wasm_exec.js loader in
 * yaegi-worker all opened with the identical pattern:
 *
 *     const res = await fetch(URL);
 *     if (!res.ok) throw new Error(`<label> fetch failed (${res.status})`);
 *
 * One helper, four call sites. Future fourth-language additions land
 * the same way without re-rolling the throw.
 */

/** Fetch a runtime asset and throw if the response status isn't OK.
 *  `label` is the human-readable filename used in the error message
 *  — defaults to the URL's last path segment if not supplied. */
export async function fetchAssetOrThrow(url: string, label?: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) {
    const name = label ?? url.split("/").pop() ?? url;
    throw new Error(`${name} fetch failed (${res.status})`);
  }
  return res;
}
