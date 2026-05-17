/*
 * Local progress storage. Minimal v0 — enough to power "resume" and
 * "you've seen N instances of this exercise" without locking in a
 * schema that prevents future gamification. The full schema is
 * documented in design-docs/11-progress-tracking.md.
 */

import { createSignal, onMount } from "solid-js";

const STORAGE_KEY = "typeover:progress";

export type ExerciseProgress = {
  firstSeenAt: string;
  lastSeenAt: string;
  instancesSeen: number;
  instancesPassed: number;
  instancesFailed: number;
  hintsUsedTotal: number;
};

export type Progress = {
  version: 1;
  startedAt: string;
  lastSeenAt: string;
  exercises: Record<string, ExerciseProgress>;
};

const empty = (): Progress => ({
  version: 1,
  startedAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  exercises: {},
});

function read(): Progress {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Progress;
    if (parsed.version !== 1) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(p: Progress) {
  if (typeof localStorage === "undefined") return;
  p.lastSeenAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function exerciseSlot(p: Progress, id: string): ExerciseProgress {
  if (!p.exercises[id]) {
    const now = new Date().toISOString();
    p.exercises[id] = {
      firstSeenAt: now,
      lastSeenAt: now,
      instancesSeen: 0,
      instancesPassed: 0,
      instancesFailed: 0,
      hintsUsedTotal: 0,
    };
  }
  return p.exercises[id]!;
}

export function recordInstanceSeen(id: string) {
  const p = read();
  const slot = exerciseSlot(p, id);
  slot.instancesSeen += 1;
  slot.lastSeenAt = new Date().toISOString();
  write(p);
}

export function recordInstancePassed(id: string) {
  const p = read();
  const slot = exerciseSlot(p, id);
  slot.instancesPassed += 1;
  slot.lastSeenAt = new Date().toISOString();
  write(p);
}

export function recordInstanceFailed(id: string) {
  const p = read();
  const slot = exerciseSlot(p, id);
  slot.instancesFailed += 1;
  slot.lastSeenAt = new Date().toISOString();
  write(p);
}

export function recordHintUsed(id: string) {
  const p = read();
  const slot = exerciseSlot(p, id);
  slot.hintsUsedTotal += 1;
  write(p);
}

/**
 * Solid signal for one exercise's progress. Reactive: pages re-render
 * when storage updates. Returns `() => undefined` on the server.
 */
export function useExerciseProgress(id: string) {
  const [state, setState] = createSignal<ExerciseProgress | undefined>();
  onMount(() => {
    setState(exerciseSlot(read(), id));
    // Refresh after any storage event from this tab too (we dispatch one
    // after each write for completeness).
    window.addEventListener("storage", () => {
      setState({ ...exerciseSlot(read(), id) });
    });
  });
  return state;
}
