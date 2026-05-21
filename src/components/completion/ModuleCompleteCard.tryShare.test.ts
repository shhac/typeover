import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tryShare } from "./ModuleCompleteCard";

/*
 * Direct unit tests for the pure share-cascade helper. Extracted
 * from ModuleCompleteCard so the Web Share → Clipboard → no-op
 * decision logic can be exercised without a Solid render.
 *
 * The AbortError-vs-other-exception distinction is the one bit
 * most likely to silently regress: cancellation must return
 * "idle" (benign), permission-denied / spec-violation must
 * return "error" (fall back to manual-copy panel).
 */

const originalNavigator = globalThis.navigator;

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
});

function setNavigator(value: Partial<Navigator> | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
  });
}

describe("tryShare — happy paths", () => {
  it("returns 'shared' when navigator.share succeeds", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    const result = await tryShare("hello", "https://example.com");
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "typeover",
      text: "hello",
      url: "https://example.com",
    });
  });

  it("falls back to clipboard.writeText when share is missing, returns 'copied'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } as unknown as Clipboard });
    const result = await tryShare("hello", "https://example.com");
    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello\nhttps://example.com");
  });

  it("prefers share over clipboard when both are present", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    const result = await tryShare("x", "y");
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("tryShare — failure paths", () => {
  it("returns 'error' when navigator is undefined (SSR / non-browser)", async () => {
    setNavigator(undefined);
    const result = await tryShare("x", "y");
    expect(result).toBe("error");
  });

  it("returns 'error' when neither share nor clipboard is available", async () => {
    setNavigator({});
    const result = await tryShare("x", "y");
    expect(result).toBe("error");
  });
});

describe("tryShare — cancellation vs throw disambiguation", () => {
  it("returns 'idle' when share throws AbortError (user dismissed the sheet)", async () => {
    const share = vi.fn().mockRejectedValue(
      new DOMException("aborted", "AbortError"),
    );
    setNavigator({ share });
    const result = await tryShare("x", "y");
    expect(result).toBe("idle");
  });

  it("returns 'error' when share throws a non-AbortError DOMException", async () => {
    const share = vi.fn().mockRejectedValue(
      new DOMException("blocked", "NotAllowedError"),
    );
    setNavigator({ share });
    const result = await tryShare("x", "y");
    expect(result).toBe("error");
  });

  it("returns 'error' when share rejects with a plain Error", async () => {
    const share = vi.fn().mockRejectedValue(new Error("crash"));
    setNavigator({ share });
    const result = await tryShare("x", "y");
    expect(result).toBe("error");
  });

  it("returns 'error' when clipboard.writeText rejects (no share fallback)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    setNavigator({ clipboard: { writeText } as unknown as Clipboard });
    const result = await tryShare("x", "y");
    expect(result).toBe("error");
  });
});
