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
