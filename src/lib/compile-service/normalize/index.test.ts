import { describe, expect, it } from "vitest";
import { LANGUAGE_REGISTRY, normalizeRust } from "./index";

describe("LANGUAGE_REGISTRY", () => {
  it("every entry's id matches its registry key", () => {
    /* The SW dispatches /api/compile/<lang> traffic by slicing the
     * URL path and indexing `LANGUAGE_REGISTRY[lang]`. If a future
     * entry's `id` field drifted from its key, the SW would
     * lookup-miss while consumers assumed the language was
     * registered. This invariant test guards future additions. */
    for (const [key, entry] of Object.entries(LANGUAGE_REGISTRY)) {
      expect(entry.id).toBe(key);
    }
  });

  it("registers Rust with the canonical normalize function", () => {
    expect(LANGUAGE_REGISTRY.rust.normalize).toBe(normalizeRust);
  });
});
