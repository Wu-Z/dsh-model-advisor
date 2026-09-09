/**
 * DeepSeek official peak / off-peak pricing.
 *
 * models.dev carries DeepSeek's *pre-peak-era* base price ($0.14/$0.28 for
 * v4-flash), which is now roughly a third of what the route actually charges.
 * The official pricing pages publish the authoritative two-tier table in both
 * currencies and are server-rendered HTML, so they are fetched and parsed here,
 * with a bundled table as the offline fallback.
 *
 * @module dsh-model-advisor/deepseek
 */

const PRICING_URL_USD = 'https://api-docs.deepseek.com/quick_start/pricing'
const PRICING_URL_CNY = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'
const REQUEST_TIMEOUT_MS = 20_000

/** Peak windows in UTC hours; a Beijing-time weekend is entirely off-peak. */
const PEAK_HOURS = [[1, 4], [6, 10]]

/** Bundled fallback: USD per 1M tokens, from the official English page. */
export const FALLBACK_USD = {
  'deepseek-v4-flash': { offPeak: { cacheRead: 0.007, input: 0.22, output: 0.66 }, peak: { cacheRead: 0.014, input: 0.44, output: 1.32 } },
  'deepseek-v4-pro': { offPeak: { cacheRead: 0.022, input: 0.66, output: 1.98 }, peak: { cacheRead: 0.044, input: 1.32, output: 3.96 } },
  'deepseek-v4-flash-vision-exp': { offPeak: { cacheRead: 0.007, input: 0.22, output: 0.66 }, peak: { cacheRead: 0.014, input: 0.44, output: 1.32 } },
}

/** Bundled fallback: CNY per 1M tokens, from the official Chinese page. */
export const FALLBACK_CNY = {
  'deepseek-v4-flash': { offPeak: { cacheRead: 0.05, input: 1.5, output: 4.5 }, peak: { cacheRead: 0.1, input: 3, output: 9 } },
  'deepseek-v4-pro': { offPeak: { cacheRead: 0.15, input: 4.5, output: 13.5 }, peak: { cacheRead: 0.3, input: 9, output: 27 } },
  'deepseek-v4-flash-vision-exp': { offPeak: { cacheRead: 0.05, input: 1.5, output: 4.5 }, peak: { cacheRead: 0.1, input: 3, output: 9 } },
}

/** Strip tags and entities from one HTML cell. */
function cellText(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse a currency amount out of one cell. */
function amount(text) {
  const match = /-?\d+(?:\.\d+)?/.exec(text.replace(/,/g, ''))
  return match === null ? Number.NaN : Number(match[0])
}

/** Which pricing metric a row label names. */
function metricOf(label) {
  if (/cache hit|缓存命中/i.test(label)) return 'cacheRead'
  if (/cache miss|缓存未命中/i.test(label)) return 'input'
  if (/output|输出/i.test(label)) return 'output'
  return ''
}

/** Which tier a row label names. */
function tierOf(label) {
  if (/off[- ]?peak|空闲时段|低谷/i.test(label)) return 'offPeak'
  if (/peak|高峰时段/i.test(label)) return 'peak'
  return ''
}

/**
 * Parse one official pricing page.
 * @param html - the fetched page.
 * @returns `{ [modelId]: { offPeak, peak } }`, empty when nothing was found.
 */
export function parsePricingPage(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(match => [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(cell => cellText(cell[1])))

  // Model columns come from the header row that names the model ids.
  let models = []
  for (const row of rows) {
    const found = row.filter(cell => /^deepseek-[a-z0-9.-]+$/i.test(cell))
    if (found.length > 1) {
      models = found
      break
    }
  }
  if (models.length === 0) return {}

  const table = {}
  let metric = ''
  for (const row of rows) {
    for (const cell of row) {
      const found = metricOf(cell)
      if (found !== '') metric = found
    }
    let tier = ''
    let tierIndex = -1
    for (let index = 0; index < row.length; index += 1) {
      const found = tierOf(row[index])
      if (found !== '') {
        tier = found
        tierIndex = index
        break
      }
    }
    if (tier === '' || metric === '') continue
    const values = row.slice(tierIndex + 1).map(amount).filter(value => Number.isFinite(value))
    if (values.length < models.length) continue
    models.forEach((model, index) => {
      table[model] = table[model] ?? { offPeak: {}, peak: {} }
      table[model][tier] = { ...table[model][tier], [metric]: values[index] }
    })
  }
  return table
}

/** Fetch one pricing page, following redirects. */
async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return await response.text()
}

/** Merge a parsed table over the bundled fallback, per model and tier. */
function merge(fallback, parsed) {
  const merged = {}
  for (const [model, tiers] of Object.entries(fallback)) merged[model] = { offPeak: { ...tiers.offPeak }, peak: { ...tiers.peak } }
  for (const [model, tiers] of Object.entries(parsed)) {
    merged[model] = merged[model] ?? { offPeak: {}, peak: {} }
    for (const tier of ['offPeak', 'peak']) {
      merged[model][tier] = { ...merged[model][tier], ...(tiers[tier] ?? {}) }
    }
  }
  return merged
}

/**
 * Read the official two-tier pricing in both currencies.
 * @returns `{ usd, cny, fetchedAt, message }`; bundled numbers back any failure.
 */
export async function readDeepSeekPricing() {
  const result = {
    usd: merge(FALLBACK_USD, {}),
    cny: merge(FALLBACK_CNY, {}),
    fetchedAt: 0,
    message: '',
  }
  const failures = []
  try {
    const parsed = parsePricingPage(await fetchPage(PRICING_URL_USD))
    if (Object.keys(parsed).length === 0) throw new Error('页面结构未识别')
    result.usd = merge(FALLBACK_USD, parsed)
  } catch (error) {
    failures.push(`美元页: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    const parsed = parsePricingPage(await fetchPage(PRICING_URL_CNY))
    if (Object.keys(parsed).length === 0) throw new Error('页面结构未识别')
    result.cny = merge(FALLBACK_CNY, parsed)
  } catch (error) {
    failures.push(`人民币页: ${error instanceof Error ? error.message : String(error)}`)
  }
  result.fetchedAt = Date.now()
  result.message = failures.length === 2 ? `使用内置价格表(${failures.join(';')})` : ''
  return result
}

/**
 * Which tier is in effect at one instant.
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
