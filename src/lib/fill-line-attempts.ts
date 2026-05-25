import type { RunResult } from "./use-runtime-run";
import { substitute } from "./generator-runtime";
import { normaliseSubmission } from "./submission-normalise";

export interface AcceptedAnswer {
  match: string;
  prebake?: boolean;
}

export interface KnownAttempt {
  match: string;
  outcome: "does-not-compile" | "wrong-output";
  stdout?: string;
  stderr?: string;
  error?: string;
  explain: string;
  durationMs?: number;
}

function renderMatch(match: string, values: Record<string, string> | undefined): string {
  return values ? substitute(match, values) : match;
}

export function matchesAcceptedAnswer(
  submission: string,
  acceptedAnswers: readonly AcceptedAnswer[] | undefined,
  values: Record<string, string> | undefined,
): AcceptedAnswer | null {
  const target = normaliseSubmission(submission);
  if (target === "") return null;
  for (const answer of acceptedAnswers ?? []) {
    if (normaliseSubmission(renderMatch(answer.match, values)) === target) return answer;
  }
  return null;
}

export function matchKnownAttempt(
  submission: string,
  knownAttempts: readonly KnownAttempt[] | undefined,
  values: Record<string, string> | undefined,
): (KnownAttempt & { runResult: RunResult }) | null {
  const target = normaliseSubmission(submission);
  if (target === "") return null;
  for (const attempt of knownAttempts ?? []) {
    if (normaliseSubmission(renderMatch(attempt.match, values)) !== target) continue;
    return {
      ...attempt,
      runResult: {
        stdout: attempt.stdout ?? "",
        stderr: attempt.stderr ?? "",
        error: attempt.error ?? "",
        durationMs: attempt.durationMs ?? 0,
      },
    };
  }
  return null;
}
