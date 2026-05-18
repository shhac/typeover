/*
 * Vitest global setup.
 *
 * jsdom provides `window` + `document` + a `localStorage` stub of its own,
 * but the stub persists across tests. We replace it with a Map-backed
 * shim and reset it in beforeEach so progress-storage tests start clean.
 */
import { beforeEach } from "vitest";

class LocalStorageShim implements Storage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

beforeEach(() => {
  /* Re-create per test so leakage from one test doesn't affect another.
   * The progress module's `read()` checks `typeof localStorage`; we
   * always provide it under test, so the SSR no-op path needs its own
   * dedicated test that explicitly unsets it. */
  Object.defineProperty(globalThis, "localStorage", {
    value: new LocalStorageShim(),
    writable: true,
    configurable: true,
  });
});
