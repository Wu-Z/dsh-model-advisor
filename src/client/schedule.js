/**
 * Balance refresh scheduling. Kept out of the store so the interval rule is
 * unit-testable without timers or a DOM.
 */

/** Fallback when the stored configuration carries no usable value. */
export const DEFAULT_BALANCE_REFRESH_MINUTES = 5

/** Lower bound: a faster poll would hammer the provider for no visible gain. */
const MIN_MINUTES = 1

/** Upper bound: one day. */
const MAX_MINUTES = 24 * 60

/**
 * Turn the configured minutes into a timer interval.
 * @param minutes - configured `balanceRefreshMinutes` (may be anything).
 * @returns interval in milliseconds, clamped to 1 minute … 24 hours.
 */
export function balanceRefreshIntervalMs(minutes) {
  const parsed = typeof minutes === 'number' ? minutes : Number(minutes)
  const safe = Number.isFinite(parsed) ? parsed : DEFAULT_BALANCE_REFRESH_MINUTES
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, safe)) * 60 * 1000
}
