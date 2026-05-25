import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { useProgressListener } from "./use-progress-listener";
import { PROGRESS_CHANGED_EVENT, STORAGE_KEY } from "./progress";

const flush = () => new Promise<void>((r) => queueMicrotask(r));

describe("useProgressListener", () => {
  it("fires refresh on a storage event with the progress key", async () => {
    await createRoot(async (dispose) => {
      const refresh = vi.fn();
      useProgressListener(refresh);
      await flush();

      // onMount fires refresh once
      const initialCalls = refresh.mock.calls.length;

      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY }),
      );

      expect(refresh).toHaveBeenCalledTimes(initialCalls + 1);
      dispose();
    });
  });

  it("fires refresh on same-tab PROGRESS_CHANGED_EVENT", async () => {
    await createRoot(async (dispose) => {
      const refresh = vi.fn();
      useProgressListener(refresh);
      await flush();

      const initialCalls = refresh.mock.calls.length;

      window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));

      expect(refresh).toHaveBeenCalledTimes(initialCalls + 1);
      dispose();
    });
  });

  it("does NOT fire on unrelated storage events (different key)", async () => {
    await createRoot(async (dispose) => {
      const refresh = vi.fn();
      useProgressListener(refresh);
      await flush();

      const initialCalls = refresh.mock.calls.length;

      window.dispatchEvent(
        new StorageEvent("storage", { key: "some-other-key" }),
      );

      expect(refresh).toHaveBeenCalledTimes(initialCalls);
      dispose();
    });
  });

  it("fires refresh on a storage event with key === null (clear)", async () => {
    await createRoot(async (dispose) => {
      const refresh = vi.fn();
      useProgressListener(refresh);
      await flush();

      const initialCalls = refresh.mock.calls.length;

      window.dispatchEvent(
        new StorageEvent("storage", { key: null }),
      );

      expect(refresh).toHaveBeenCalledTimes(initialCalls + 1);
      dispose();
    });
  });

  it("calls refresh once on mount", async () => {
    await createRoot(async (dispose) => {
      const refresh = vi.fn();
      useProgressListener(refresh);

      // Before flush, onMount hasn't fired
      expect(refresh).not.toHaveBeenCalled();

      await flush();

      expect(refresh).toHaveBeenCalledTimes(1);
      dispose();
    });
  });

  it("cleans up both listeners on unmount", async () => {
    const refresh = vi.fn();

    const dispose = await new Promise<() => void>((resolve) => {
      createRoot(async (d) => {
        useProgressListener(refresh);
        await flush();
        resolve(d);
      });
    });

    const callsAfterMount = refresh.mock.calls.length;

    // Dispose triggers onCleanup
    dispose();

    // Events after dispose should NOT fire refresh
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY }),
    );
    window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));

    expect(refresh).toHaveBeenCalledTimes(callsAfterMount);
  });
});
