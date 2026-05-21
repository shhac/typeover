/** Single source of truth for "ISO timestamp right now". Was
 *  duplicated as a private `now()` in both `progress.ts` and
 *  `progress-schema.ts` after the schema split — extracted so a
 *  future timestamp-format change (epoch ms, Date object,
 *  monotonic counter) only edits one file. */
export const nowIso = (): string => new Date().toISOString();
