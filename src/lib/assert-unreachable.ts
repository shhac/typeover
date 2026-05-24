/*
 * Exhaustiveness-checking helper for discriminated unions.
 *
 * Usage:
 *   switch (kind) {
 *     case "a": ...
 *     case "b": ...
 *     default: return assertUnreachable(kind);
 *   }
 *
 * If a new variant is added to `kind` later, the `default` branch
 * stops type-checking (the parameter narrows to that new variant
 * instead of `never`), so the compiler points at every switch that
 * needs a new case. Cheaper and clearer than nested ternaries with
 * a trailing `null` for "shouldn't happen."
 *
 * Throws at runtime if execution somehow reaches it (the TS-level
 * `never` proof depends on the union being honestly typed).
 */
export function assertUnreachable(x: never): never {
  throw new Error(`Unreachable case: ${JSON.stringify(x)}`);
}
