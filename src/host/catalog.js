/**
 * models.dev catalog: fetch, project, cache, and search.
 *
 * The upstream document is ~4.5 MB across 200+ providers. It is fetched and
 * projected on the Host, trimmed to the fields the panel renders, cached to
 * disk, and searched server-side so the browser only ever receives the rows it
 * is about to display.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { applyPriceTags, hasVision, MODALITY_FILTERS, summaryFor, tagsFor } from './domains.js'
import { catalogPath } from './paths.js'

const CATALOG_URL = 'https://models.dev/api.json'
const REQUEST_TIMEOUT_MS = 30_000

/** Providers whose newest models are surfaced as the browse list, in order. */
const FEATURED_PROVIDERS = [
  'deepseek',
  'anthropic',
  'openai',
  'google',
  'xai',
  'moonshotai',
  'zai',
  'minimax',
  'alibaba',
  'mistral',
]

/** How many newest models per featured provider the browse list carries. */
const FEATURED_PER_PROVIDER = 5

/** Maximum rows a single search answers with. */
export const SEARCH_LIMIT = 40

/** An empty, JSON-safe catalog state. */
export function emptyCatalogState() {
  return { fetchedAt: 0, count: 0, stale: true, message: '' }
}

/** Convert a possibly-stringified decimal into a finite number. */
function decimal(value) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Convert an unknown to a trimmed string, capped. */
function text(value, max = 400) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

/** Project one models.dev model entry into a panel row. */
function projectRow(providerId, providerName, providerDoc, model) {
  const id = text(model?.id, 200)
  if (id.length === 0) return null
  const inputModalities = Array.isArray(model?.modalities?.input) ? model.modalities.input.map(String) : []
  const outputModalities = Array.isArray(model?.modalities?.output) ? model.modalities.output.map(String) : []
  const rawCost = model?.cost !== null && typeof model?.cost === 'object' ? model.cost : null
  const cost = rawCost === null
    ? null
    : {
      input: decimal(rawCost.input),
      output: decimal(rawCost.output),
      cacheRead: decimal(rawCost.cache_read ?? rawCost.cacheRead),
      cacheWrite: decimal(rawCost.cache_write ?? rawCost.cacheWrite),
    }
  // A zero/zero pair means the channel has no per-token price — subscription
  // plans (alibaba-token-plan, zai-coding-plan, gitlab, …) report 0 there, which
  // is not a free model. Treating it as priced also wrongly won the cheapest
  // price tag and sorted these rows to the top.
  const priced = cost !== null && (cost.input > 0 || cost.output > 0) ? cost : null
  const base = {
    key: `${providerId}/${id}`,
    provider: providerId,
    providerName,
    id,
    name: text(model?.name, 200) || id,
    family: text(model?.family, 120),
    description: text(model?.description, 400),
    reasoning: model?.reasoning === true,
    toolCall: model?.tool_call === true,
    vision: hasVision(inputModalities),
    inputModalities,
    outputModalities,
    openWeights: model?.open_weights === true,
    context: decimal(model?.limit?.context),
    maxOutput: decimal(model?.limit?.output),
    cost: priced,
    releaseDate: text(model?.release_date, 20),
  }
  const domains = tagsFor(base)
  return {
    ...base,
    domains,
    summary: summaryFor(base, domains),
    configured: false,
    isDefault: false,
    channelName: '',
    priceFallback: false,
    priceKind: priced === null ? 'unknown' : 'listed',
    priceRef: null,
    tiers: null,
    source: 'catalog',
  }
}

/** Channels that bill by subscription, so they publish no per-token price. */
const PLAN_CHANNEL = /token-plan|coding-plan|for-coding|opencode|gitlab|poolside|kuae|scnet|umans/

/** A model id ending in `:free` is an explicitly free variant. */
const FREE_MODEL = /:free$/i

/**
 * Why a row has no per-token price. `plan` and `free` are stated facts about the
 * channel; `unknown` is the honest fallback.
 * @param row - projected row with no price.
 * @returns `'plan' | 'free' | 'unknown'`.
 */
function priceKindFor(row) {
  if (FREE_MODEL.test(row.id)) return 'free'
  if (PLAN_CHANNEL.test(row.provider)) return 'plan'
  return 'unknown'
}

/**
 * Attach a reference price to every unpriced row that has a priced twin on
 * another channel. The reference is display-only: `cost` stays null so these
 * rows never win the cheapest tag or sort to the top of a price sort.
 * @param rows - projected rows, mutated in place.
 */
export function applyReferencePrices(rows) {
  const best = new Map()
  for (const row of rows) {
    if (row.cost === null) continue
    const key = normalizeModelId(row.id)
    const candidate = { row, firstParty: FIRST_PARTY_PROVIDERS.has(row.provider) }
    const existing = best.get(key)
    if (existing === undefined
      || (candidate.firstParty && !existing.firstParty)) {
      best.set(key, candidate)
    }
  }
  for (const row of rows) {
    if (row.cost !== null) continue
    row.priceKind = priceKindFor(row)
    const reference = best.get(normalizeModelId(row.id))
    if (reference === undefined) continue
    row.priceKind = 'reference'
    row.priceRef = {
      input: reference.row.cost.input,
      output: reference.row.cost.output,
      cacheRead: reference.row.cost.cacheRead,
      providerName: reference.row.providerName,
    }
  }
  return rows
}

/**
 * Fetch and project the upstream catalog.
 * @returns `{ rows, fetchedAt }`.
 * @throws when the endpoint fails or returns an unusable document.
 */
export async function fetchCatalog() {
  const response = await fetch(CATALOG_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  const document = await response.json()
  if (document === null || typeof document !== 'object') {
    throw new Error('models.dev 返回了非对象文档')
  }
  const rows = []
  for (const [providerId, provider] of Object.entries(document)) {
    const providerName = text(provider?.name, 120) || providerId
    const providerDoc = text(provider?.doc, 400)
    const models = provider?.models !== null && typeof provider?.models === 'object' ? provider.models : {}
    for (const model of Object.values(models)) {
      const row = projectRow(providerId, providerName, providerDoc, model)
      if (row !== null) rows.push(row)
    }
  }
  if (rows.length === 0) throw new Error('models.dev 文档里没有模型条目')
  applyReferencePrices(rows)
  applyPriceTags(rows)
  return { rows, fetchedAt: Date.now() }
}

/** Persist the projected catalog next to the plugin's config. */
export async function writeCatalogCache(rows, fetchedAt) {
  const path = catalogPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify({ fetchedAt, rows }), 'utf8')
}

/**
 * Read the persisted catalog.
 * @returns `{ rows, fetchedAt }`; empty rows when nothing is cached yet.
 */
export async function readCatalogCache() {
  try {
    const raw = await readFile(catalogPath(), 'utf8')
    const parsed = JSON.parse(raw)
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : []
    return { rows, fetchedAt: decimal(parsed?.fetchedAt) }
  } catch {
    return { rows: [], fetchedAt: 0 }
  }
}

/**
 * Build the browse list: the newest few models of each featured provider.
 * @param rows - full catalog projection.
 * @returns a stable, small list for the default panel view.
 */
export function featuredRows(rows) {
  const byProvider = new Map()
  for (const row of rows) {
    const bucket = byProvider.get(row.provider)
    if (bucket === undefined) byProvider.set(row.provider, [row])
    else bucket.push(row)
  }
  const featured = []
  for (const provider of FEATURED_PROVIDERS) {
    const bucket = byProvider.get(provider)
    if (bucket === undefined) continue
    bucket.sort((left, right) => right.releaseDate.localeCompare(left.releaseDate))
    featured.push(...bucket.slice(0, FEATURED_PER_PROVIDER))
  }
  return featured
}

/**
 * Providers that own the models they list. When one model id appears under
 * several channels at different prices, the owner's list price is the reference
 * a user compares against, so those rows win a duplicate.
 */
const FIRST_PARTY_PROVIDERS = new Set([
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'xai',
  'mistral',
  'moonshotai',
  'zai',
  'minimax',
  'alibaba',
  'cohere',
  'meta',
])

/** Vendor words resellers glue in front of a model id. */
const VENDOR_WORDS = [
  'anthropic', 'openai', 'google', 'meta', 'mistral', 'deepseek', 'moonshotai', 'moonshot',
  'zai', 'minimax', 'qwen', 'alibaba', 'xai', 'cohere', 'microsoft', 'amazon', 'nvidia',
  'tencent', 'baidu', 'bytedance', 'stepfun', 'ai21', 'yi',
]

/**
 * Normalize a model id across channels: drop path prefixes, punctuation, and
 * any leading vendor word a reseller repeats (`anthropic:claude-sonnet-4`,
 * `deepseek/deepseek-v4-flash`), so one model collapses to one key.
 */
function normalizeModelId(id) {
  let bare = id.toLowerCase().replace(/^.*\//, '').replace(/[^a-z0-9]/g, '')
  let stripped = true
  while (stripped) {
    stripped = false
    for (const word of VENDOR_WORDS) {
      if (bare.length > word.length && bare.startsWith(word)) {
        bare = bare.slice(word.length)
        stripped = true
        break
      }
    }
  }
  return bare
}

/**
 * Collapse duplicate rows for one model, preferring the owning provider.
 * @param rows - candidate rows in preference order.
 * @returns one row per normalized model id.
 */
function preferFirstParty(rows) {
  const byId = new Map()
  for (const row of rows) {
    const key = normalizeModelId(row.id)
    const existing = byId.get(key)
    if (existing === undefined) {
      byId.set(key, row)
      continue
    }
    if (FIRST_PARTY_PROVIDERS.has(row.provider) && !FIRST_PARTY_PROVIDERS.has(existing.provider)) {
      byId.set(key, row)
    }
  }
  return [...byId.values()]
}

/** Score one row against a lowercased query; 0 means no match. */
function scoreRow(row, query) {
  const id = row.id.toLowerCase()
  const name = row.name.toLowerCase()
  if (id === query || name === query) return 100
  if (id.startsWith(query) || name.startsWith(query)) return 80
  if (id.includes(query) || name.includes(query)) return 60
  // Punctuation differs between channels (`claude-fable-5-1` vs `5.1`), so a
  // normalized comparison keeps the owner's row reachable from either spelling.
  const bare = query.replace(/[^a-z0-9]/g, '')
  if (bare.length > 0) {
    const bareId = normalizeModelId(row.id)
    const bareName = name.replace(/[^a-z0-9]/g, '')
    if (bareId === bare || bareName === bare) return 95
    if (bareId.startsWith(bare)) return 75
    if (bareId.includes(bare)) return 55
  }
  if (row.family.toLowerCase().includes(query)) return 40
  if (row.providerName.toLowerCase().includes(query) || row.provider.toLowerCase().includes(query)) return 30
  if (row.description.toLowerCase().includes(query)) return 20
  if (row.domains.some(tag => tag.includes(query))) return 15
  return 0
}

/**
 * Find the row one model carries on a specific channel.
 * @param rows - full catalog projection.
 * @param channel - models.dev provider id, or `''` for no known channel.
 * @param modelId - the configured model id.
 * @returns the channel's row, or `null` when that channel does not list it.
 */
export function findChannelRow(rows, channel, modelId) {
  if (channel.length === 0) return null
  const bare = normalizeModelId(modelId)
  for (const row of rows) {
    if (row.provider !== channel) continue
    if (row.id === modelId || normalizeModelId(row.id) === bare) return row
  }
  return null
}

/**
 * Search the projected catalog.
 * @param rows - full catalog projection.
 * @param query - raw user query; empty with no facets returns the browse list.
 * @param domains - selected strength tags; OR within the group.
 * @param modalities - selected modality labels; OR within the group.
 * @returns up to {@link SEARCH_LIMIT} rows, best matches first.
 */
export function searchRows(rows, query, domains, modalities) {
  const trimmed = typeof query === 'string' ? query.trim().toLowerCase() : ''
  const wantedDomains = Array.isArray(domains) ? domains.filter(tag => typeof tag === 'string' && tag.length > 0) : []
  const wantedModalities = Array.isArray(modalities) ? modalities.filter(key => typeof key === 'string' && key.length > 0) : []
  if (trimmed.length === 0 && wantedDomains.length === 0 && wantedModalities.length === 0) {
    return featuredRows(rows).slice(0, SEARCH_LIMIT)
  }

  let pool
  if (trimmed.length > 0) {
    const scored = []
    for (const row of rows) {
      const score = scoreRow(row, trimmed)
      if (score > 0) scored.push({ score, row })
    }
    // Ties break toward the owning provider, then the newer release: a search
    // for a family should surface the current official model, not an older
    // reseller row.
    scored.sort((left, right) => right.score - left.score
      || Number(FIRST_PARTY_PROVIDERS.has(right.row.provider)) - Number(FIRST_PARTY_PROVIDERS.has(left.row.provider))
      || right.row.releaseDate.localeCompare(left.row.releaseDate)
      || left.row.name.localeCompare(right.row.name))
    pool = scored.map(entry => entry.row)
  } else {
    // A domain filter alone ranks the WHOLE catalog — the featured list is only
    // the newest flagship per vendor, so filtering it alone reported "no maths
    // models" while the catalog carried 138 of them.
    pool = [...rows].sort((left, right) =>
      Number(FIRST_PARTY_PROVIDERS.has(right.provider)) - Number(FIRST_PARTY_PROVIDERS.has(left.provider))
      || right.releaseDate.localeCompare(left.releaseDate))
  }
  // Facets: OR within a group, AND across groups.
  let filtered = pool
  if (wantedDomains.length > 0) {
    filtered = filtered.filter(row => wantedDomains.some(tag => row.domains.includes(tag)))
  }
  if (wantedModalities.length > 0) {
    const rules = MODALITY_FILTERS.filter(entry => wantedModalities.includes(entry.label))
    filtered = filtered.filter(row => rules.some((entry) => {
      const list = entry.direction === 'input' ? row.inputModalities : row.outputModalities
      return Array.isArray(list) && list.includes(entry.modality)
    }))
  }
  // One row per model: the owner's price wins over a reseller carrying the same id.
  return preferFirstParty(filtered).slice(0, SEARCH_LIMIT)
}

/**
 * Find the catalog row matching one configured provider/model pair.
 * @param rows - full catalog projection.
 * @param provider - configured provider id.
 * @param modelId - configured model id.
 * @returns the matching row, or `null`.
 */
export function findRow(rows, provider, modelId) {
  const exact = rows.find(row => row.provider === provider && row.id === modelId)
  if (exact !== undefined) return exact
  const candidates = rows.filter(row => row.id === modelId)
  // Cross-channel fallback still prefers the owner's price over a reseller's.
  return candidates.find(row => FIRST_PARTY_PROVIDERS.has(row.provider)) ?? candidates[0] ?? null
}

/**
 * Build a local-only row for a configured model the catalog does not describe.
 * @param provider - configured provider id.
 * @param model - configured model metadata from the LLM registry.
 * @param links - precomputed link set for the provider.
 * @returns a JSON-safe row marked `source: 'local'`.
 */
export function localRow(provider, model) {
  const id = text(model?.id, 200)
  const base = {
    key: `${provider}/${id}`,
    provider,
    providerName: text(model?.providerName, 120) || provider,
    id,
    name: text(model?.name, 200) || id,
    family: '',
    description: text(model?.description, 400),
    reasoning: model?.reasoning === true,
    toolCall: false,
    vision: Array.isArray(model?.inputModalities) && hasVision(model.inputModalities),
    inputModalities: Array.isArray(model?.inputModalities) ? model.inputModalities.map(String) : [],
    outputModalities: [],
    openWeights: false,
    context: decimal(model?.contextWindow),
    maxOutput: decimal(model?.maxTokens),
    cost: null,
    releaseDate: '',
  }
  const domains = tagsFor(base)
  return {
    ...base,
    domains,
    summary: summaryFor(base, domains),
    configured: true,
    isDefault: false,
    channelName: '',
    priceFallback: false,
    priceKind: 'unknown',
    priceRef: null,
    tiers: null,
    source: 'local',
  }
}
