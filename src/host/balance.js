/**
 * Balance and exchange-rate readers.
 *
 * The DeepSeek endpoint is the default; a custom HTTP endpoint can replace or
 * supplement it. No secret value ever leaves this module: the API key is read
 * from the harness credential store and only used as a request header.
 */

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'
const FX_URL = 'https://open.er-api.com/v6/latest/USD'
const REQUEST_TIMEOUT_MS = 12_000

/** An empty, JSON-safe balance state. */
export function emptyBalance() {
  return {
    ok: false,
    currency: 'CNY',
    total: 0,
    granted: 0,
    toppedUp: 0,
    source: 'none',
    message: '',
    fetchedAt: 0,
  }
}

/** Parse a possibly-stringified decimal into a finite number. */
function decimal(value) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Fetch JSON with a hard timeout, returning the parsed body. */
async function getJson(url, headers) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return await response.json()
}

/**
 * Read the DeepSeek official balance.
 * @param apiKey - plaintext key resolved from the credential store.
 * @returns JSON-safe balance state.
 */
export async function readDeepSeekBalance(apiKey) {
  const base = emptyBalance()
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    return { ...base, message: '未配置 DEEPSEEK_API_KEY' }
  }
  try {
    const data = await getJson(DEEPSEEK_BALANCE_URL, { authorization: `Bearer ${apiKey}` })
    const infos = Array.isArray(data?.balance_infos) ? data.balance_infos : []
    const info = infos.find(entry => entry?.currency === 'CNY') ?? infos[0]
    if (info === undefined) return { ...base, message: '余额接口未返回 balance_infos' }
    return {
      ok: true,
      currency: typeof info.currency === 'string' ? info.currency : 'CNY',
      total: decimal(info.total_balance),
      granted: decimal(info.granted_balance),
      toppedUp: decimal(info.topped_up_balance),
      source: 'deepseek',
      message: '',
      fetchedAt: Date.now(),
    }
  } catch (error) {
    return { ...base, message: error instanceof Error ? error.message : String(error) }
  }
}

/** Resolve a dot path such as `data.total_available` against a parsed body. */
function readPath(value, path) {
  if (path.length === 0) return value
  let cursor = value
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined
    cursor = cursor[segment]
  }
  return cursor
}

/**
 * Read a user-configured balance endpoint.
 * @param config - normalized `customBalance` section.
 * @param resolveSecret - async resolver returning the plaintext key or undefined.
 * @returns JSON-safe balance state.
 */
export async function readCustomBalance(config, resolveSecret) {
  const base = emptyBalance()
  if (config.url.length === 0) return { ...base, message: '自定义余额端点未填写 URL' }
  try {
    const headers = { accept: 'application/json' }
    if (config.credentialRef.length > 0 && typeof resolveSecret === 'function') {
      const secret = await resolveSecret(config.credentialRef)
      if (typeof secret === 'string' && secret.length > 0) {
        headers[config.headerName.toLowerCase()] = config.headerName.toLowerCase() === 'authorization'
          ? `Bearer ${secret}`
          : secret
      }
    }
    const data = await getJson(config.url, headers)
    const raw = readPath(data, config.path)
    const total = decimal(raw)
    if (!Number.isFinite(Number(raw))) {
      return { ...base, message: `取值路径 ${config.path || '(root)'} 未得到数字` }
    }
    return {
      ok: true,
      currency: config.currency,
      total,
      granted: 0,
      toppedUp: 0,
      source: 'custom',
      message: '',
      fetchedAt: Date.now(),
    }
  } catch (error) {
    return { ...base, message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Read the live USD→CNY rate.
 * @returns `{ rate, fetchedAt }`, or `null` when the lookup failed.
 */
export async function readFxRate() {
  try {
    const data = await getJson(FX_URL, {})
    const rate = decimal(data?.rates?.CNY)
    if (rate <= 0) return null
    return { rate, fetchedAt: Date.now() }
  } catch {
    return null
  }
}
