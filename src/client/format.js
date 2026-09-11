/** Display formatting for the model advisor panel. */

const SYMBOL = { USD: '$', CNY: '¥' }

/** Symbol for one currency, falling back to its code. */
export function symbol(currency) {
  return SYMBOL[currency] ?? `${currency} `
}

/** Render an amount with two decimals and its currency symbol. */
export function formatMoney(value, currency) {
  const amount = Number.isFinite(value) ? value : 0
  return `${symbol(currency)}${amount.toFixed(2)}`
}

/**
 * Render one per-million-token price in the chosen display currency.
 * @param value - USD per 1M tokens.
 * @param currency - display currency.
 * @param fxRate - USD→CNY rate used when the display currency is CNY.
 * @returns a compact price string such as `$0.14` or `¥1.01`.
 */
export function formatPrice(value, currency, fxRate) {
  if (!Number.isFinite(value)) return '—'
  const converted = currency === 'CNY' ? value * (fxRate > 0 ? fxRate : 7.2) : value
  const digits = converted >= 10 ? 2 : converted >= 1 ? 3 : 4
  const rounded = Number(converted.toFixed(digits))
  return `${symbol(currency)}${String(rounded)}`
}

/** Render a token count as 1M / 128K / 4096. */
export function formatTokens(value) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

/** Render a millisecond timestamp as a short local time, or 「尚未更新」. */
export function formatWhen(value, neverLabel) {
  if (!Number.isFinite(value) || value <= 0) return neverLabel
  const date = new Date(value)
  const pad = number => String(number).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Format a number already expressed in the display currency. */
export function formatAmount(value, currency) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const digits = value >= 1 ? 2 : 3
  return `${symbol(currency)}${String(Number(value.toFixed(digits)))}`
}

/**
 * Peak windows in UTC hours — 01:00–04:00 and 06:00–10:00, i.e. 09:00–12:00 and
 * 14:00–18:00 Beijing time (UTC+8). A Beijing-time weekend is entirely off-peak.
 */
const PEAK_HOURS = [[1, 4], [6, 10]]

/**
 * Which DeepSeek tier is in effect now, mirroring the host rule.
 * @param at - epoch milliseconds; defaults to now.
 * @returns `'peak'` or `'offPeak'`.
 */
export function currentTier(at = Date.now()) {
  const beijing = new Date(at + 8 * 60 * 60 * 1000)
  const weekday = beijing.getUTCDay()
  if (weekday === 0 || weekday === 6) return 'offPeak'
  const hour = new Date(at).getUTCHours()
  return PEAK_HOURS.some(([start, end]) => hour >= start && hour < end) ? 'peak' : 'offPeak'
}

/** Format one instant as Beijing (UTC+8) wall-clock `HH:MM`. */
export function formatBeijingClock(atMs) {
  const shifted = new Date(atMs + 8 * 60 * 60 * 1000)
  const pad = value => String(value).padStart(2, '0')
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** Beijing weekday labels, indexed by `getUTCDay()`. */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * Format a switch instant for the tooltip. Beyond today it names the day, so a
 * weekend countdown reads 「周一 09:00」 instead of a bare clock time.
 * @param atMs - the switch instant.
 * @param nowMs - the reference instant; defaults to now.
 * @returns `HH:MM`, `明天 HH:MM`, or `周X HH:MM`.
 */
export function formatBeijingSwitch(atMs, nowMs = Date.now()) {
  const clock = formatBeijingClock(atMs)
  const dayOf = value => Math.floor((value + 8 * 60 * 60 * 1000) / 86_400_000)
  const delta = dayOf(atMs) - dayOf(nowMs)
  if (delta <= 0) return clock
  if (delta === 1) return `明天 ${clock}`
  return `${WEEKDAYS[new Date(atMs + 8 * 60 * 60 * 1000).getUTCDay()]} ${clock}`
}

/** Format a duration as `1 小时 20 分` / `42 分钟`. */
export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`
}

/**
 * Find when the DeepSeek tier next flips, so the footer badge can count down.
 * Scans forward at one-minute resolution; the schedule is simple enough that a
 * scan is more obviously correct than a pile of boundary arithmetic.
 * @param at - epoch milliseconds; defaults to now.
 * @returns `{ atMs, intoPeak, remainingMs }`; three days out when nothing flips.
 */
export function nextTierSwitch(at = Date.now()) {
  const current = currentTier(at)
  const minute = 60_000
  const limit = at + 3 * 24 * 60 * minute
  for (let cursor = at + minute; cursor <= limit; cursor += minute) {
    const tier = currentTier(cursor)
    if (tier !== current) return { atMs: cursor, intoPeak: tier === 'peak', remainingMs: cursor - at }
  }
  return { atMs: limit, intoPeak: current !== 'peak', remainingMs: limit - at }
}
