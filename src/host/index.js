/**
 * Host half: the `modelAdvisor` service behind the Typert Remote.
 *
 * Owns every network read (balance, exchange rate, models.dev), every secret
 * read (credentials never leave this process), the on-disk caches, and the
 * JSON-safe projections the browser panel renders. The browser half only ever
 * receives rows it is about to display.
 *
 * @module dsh-model-advisor
 */

import { emptyBalance, readCustomBalance, readDeepSeekBalance, readFxRate } from './balance.js'
import {
  emptyCatalogState,
  fetchCatalog,
  featuredRows,
  findChannelRow,
  findRow,
  localRow,
  readCatalogCache,
  searchRows,
  writeCatalogCache,
} from './catalog.js'
import { DOMAIN_TAGS, normalizeConfig, readStoredConfig, writeStoredConfig } from './config.js'
import { MODALITY_TAGS } from './domains.js'
import { readDeepSeekPricing } from './deepseek.js'
import { linksFor } from './links.js'

/** Cordis plugin name. */
export const name = 'model-advisor'

/** No mandatory services: every host capability is resolved optionally. */
export const inject = []

/** How long a live USD→CNY rate stays fresh. */
const FX_TTL_MS = 12 * 60 * 60 * 1000

/** How long the configured-model projection is reused before re-reading the registry. */
const CONFIGURED_TTL_MS = 5_000

/** How long the official DeepSeek two-tier table stays fresh. */
const DEEPSEEK_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Balance endpoints keyed by the models.dev channel a model is served through.
 * A channel with no entry has no balance API, and the panel says so instead of
 * showing another provider's number.
 */
const BALANCE_SOURCES = {
  deepseek: {
    kind: 'deepseek',
    label: 'DeepSeek 官方余额接口',
    url: 'https://platform.deepseek.com/usage',
    credentialRef: 'DEEPSEEK_API_KEY',
  },
}

/** The model catalog this panel reads, credited in the data-source row. */
const CATALOG_SOURCE = { label: 'models.dev', url: 'https://models.dev' }

/** Configured provider id → models.dev provider id. */
const PROVIDER_ALIASES = {
  'deepseek-official': 'deepseek',
  deepseek: 'deepseek',
  'z-ai': 'zai',
  zai: 'zai',
  moonshot: 'moonshotai',
  'moonshot-ai': 'moonshotai',
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  gemini: 'google',
  xai: 'xai',
}

/** Map one configured provider id onto its models.dev id. */
function catalogProviderFor(provider) {
  return PROVIDER_ALIASES[provider] ?? provider
}

/**
 * Endpoint host → models.dev provider id, for routes whose own id says nothing
 * about the channel they bill through (a self-named gateway pointed at a vendor).
 */
const HOST_PROVIDERS = [
  ['api.deepseek.com', 'deepseek'],
  ['api.anthropic.com', 'anthropic'],
  ['api.openai.com', 'openai'],
  ['generativelanguage.googleapis.com', 'google'],
  ['aiplatform.googleapis.com', 'google-vertex'],
  ['api.x.ai', 'xai'],
  ['api.moonshot.cn', 'moonshotai'],
  ['api.moonshot.ai', 'moonshotai'],
  ['api.z.ai', 'zai'],
  ['open.bigmodel.cn', 'zai'],
  ['api.minimax.chat', 'minimax'],
  ['api.minimaxi.com', 'minimax'],
  ['dashscope.aliyuncs.com', 'alibaba'],
  ['openrouter.ai', 'openrouter'],
  ['api.siliconflow.cn', 'siliconflow'],
  ['api.mistral.ai', 'mistral'],
  ['api.groq.com', 'groq'],
  ['api.together.xyz', 'together'],
  ['api.deepinfra.com', 'deepinfra'],
  ['api.cerebras.ai', 'cerebras'],
  ['ark.cn-beijing.volces.com', 'volcengine'],
]

/** The hostname of a base URL, or `''` when it cannot be parsed. */
function hostOf(baseURL) {
  if (typeof baseURL !== 'string' || baseURL.length === 0) return ''
  try {
    return new URL(baseURL).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Resolve one endpoint host onto a models.dev provider id. */
function providerForHost(host) {
  if (host.length === 0) return ''
  const hit = HOST_PROVIDERS.find(([candidate]) => host === candidate || host.endsWith(`.${candidate}`))
  return hit === undefined ? '' : hit[1]
}

/**
 * Read the harness connection configuration the panel prices against.
 * `llm-pi-ai.providers.<id>.baseURL` is where a gateway route states its
 * endpoint; the DeepSeek adapter's own route has no user base URL and is
 * aliased by provider id instead.
 * @param ctx - host context.
 * @returns configured provider id → endpoint hostname.
 */
function providerHosts(ctx) {
  const hosts = new Map()
  const settings = ctx.get('settings')
  if (settings === undefined || typeof settings.get !== 'function') return hosts
  let section
  try {
    section = settings.get('llm-pi-ai')
  } catch {
    return hosts
  }
  const providers = section !== null && typeof section === 'object' ? section.providers : undefined
  if (providers === null || typeof providers !== 'object') return hosts
  for (const [id, profile] of Object.entries(providers)) {
    const host = hostOf(profile?.baseURL)
    if (host.length > 0) hosts.set(id, host)
  }
  return hosts
}

/**
 * Resolve the models.dev channel a configured route actually bills through.
 * @param providerId - configured provider id.
 * @param host - endpoint hostname when the route declares one.
 * @returns a models.dev provider id, or `''` when the channel is unknown.
 */
function resolveChannel(providerId, host) {
  const aliased = catalogProviderFor(providerId)
  if (aliased !== providerId) return aliased
  const byHost = providerForHost(host)
  return byHost
}

/** Read a secret without letting a store failure break the caller. */
async function resolveSecret(ctx, ref) {
  if (typeof ref !== 'string' || ref.length === 0) return undefined
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return process.env[ref]
  try {
    const hit = await credentials.resolve(ref)
    if (hit !== null && typeof hit === 'object' && typeof hit.value === 'string') return hit.value
  } catch {
    // Fall through to the environment: a store failure is not a missing key.
  }
  return process.env[ref]
}

/**
 * Mount the model advisor service.
 * @param ctx - host plugin context.
 * @param rawConfig - optional config from the profile composition.
 */
export function apply(ctx, rawConfig) {
  const stored = { value: normalizeConfig(rawConfig) }
  const state = {
    rows: [],
    catalogFetchedAt: 0,
    catalogMessage: '',
    balance: emptyBalance(),
    fxRate: 0,
    fxFetchedAt: 0,
    fxLive: false,
    deepseek: { usd: {}, cny: {}, fetchedAt: 0, message: '' },
    balanceTarget: { kind: 'none', label: '', url: '', channel: '' },
    loadedCache: false,
    configuredRows: [],
    configuredAt: 0,
    refreshing: null,
  }

  const effectiveConfig = () => stored.value

  const isCatalogStale = () => {
    if (state.rows.length === 0) return true
    const ttl = effectiveConfig().catalogTtlHours * 60 * 60 * 1000
    return Date.now() - state.catalogFetchedAt > ttl
  }

  const isBalanceStale = () => {
    if (state.balance.fetchedAt === 0) return true
    const ttl = effectiveConfig().balanceRefreshMinutes * 60 * 1000
    return Date.now() - state.balance.fetchedAt > ttl
  }

  const isFxStale = () => state.fxFetchedAt === 0 || Date.now() - state.fxFetchedAt > FX_TTL_MS

  const isDeepSeekStale = () => state.deepseek.fetchedAt === 0 || Date.now() - state.deepseek.fetchedAt > DEEPSEEK_TTL_MS

  /**
   * Stamp the official DeepSeek two-tier prices onto every DeepSeek row.
   * The headline `cost` becomes the off-peak price (what the route charges most
   * of the day) and the tiers carry both, in both currencies.
   */
  const applyDeepSeekPricing = () => {
    const { usd, cny } = state.deepseek
    for (const row of state.rows) {
      if (row.provider !== 'deepseek') continue
      const tiers = usd[row.id]
      if (tiers === undefined) continue
      const native = cny[row.id] ?? {}
      const tierRows = ['offPeak', 'peak'].map((key) => {
        const tier = tiers[key] ?? {}
        const local = native[key] ?? {}
        return {
          key,
          input: Number(tier.input ?? 0),
          output: Number(tier.output ?? 0),
          cacheRead: Number(tier.cacheRead ?? 0),
          inputCny: Number(local.input ?? 0),
          outputCny: Number(local.output ?? 0),
          cacheReadCny: Number(local.cacheRead ?? 0),
        }
      })
      row.tiers = tierRows
      row.cost = {
        input: tierRows[0].input,
        output: tierRows[0].output,
        cacheRead: tierRows[0].cacheRead,
        cacheWrite: 0,
      }
    }
  }

  /** Refresh the official DeepSeek two-tier table. */
  const refreshDeepSeek = async () => {
    try {
      state.deepseek = await readDeepSeekPricing()
    } catch (error) {
      state.deepseek = {
        ...state.deepseek,
        message: error instanceof Error ? error.message : String(error),
      }
    }
    applyDeepSeekPricing()
  }

  /** Load the on-disk catalog once per process. */
  const loadCache = async () => {
    if (state.loadedCache) return
    state.loadedCache = true
    const cached = await readCatalogCache()
    if (cached.rows.length > 0 && state.rows.length === 0) {
      state.rows = cached.rows
      state.catalogFetchedAt = cached.fetchedAt
      applyDeepSeekPricing()
    }
  }

  /** Refresh the models.dev projection; keeps the last good rows on failure. */
  const refreshCatalog = async () => {
    try {
      const fetched = await fetchCatalog()
      state.rows = fetched.rows
      state.catalogFetchedAt = fetched.fetchedAt
      state.catalogMessage = ''
      applyDeepSeekPricing()
      await writeCatalogCache(fetched.rows, fetched.fetchedAt)
    } catch (error) {
      state.catalogMessage = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * The models.dev channel of the model the user currently has selected, which
   * is what makes the balance follow the model rather than always naming one
   * provider.
   */
  const currentChannel = () => {
    const selection = ctx.get('agentDefaultModel')?.currentSelection()
    const providerId = typeof selection?.provider === 'string' ? selection.provider : ''
    // No selection at all falls back to the built-in provider; a selected model
    // whose channel is unknown stays unknown, so the panel can say so.
    if (providerId.length === 0) return 'deepseek'
    return resolveChannel(providerId, providerHosts(ctx).get(providerId) ?? '')
  }

  /** Resolve which balance endpoint the current model implies. */
  const resolveBalanceTarget = () => {
    const config = effectiveConfig()
    const channel = currentChannel()
    if (config.customBalance.enabled) {
      let label = config.customBalance.url
      try {
        label = new URL(config.customBalance.url).hostname
      } catch {
        // A malformed URL keeps the raw text as its label.
      }
      return { kind: 'custom', label, url: config.customBalance.url, channel, credentialRef: config.customBalance.credentialRef }
    }
    const source = BALANCE_SOURCES[channel]
    if (source !== undefined) return { ...source, channel }
    return { kind: 'none', label: '', url: '', channel }
  }

  /** Refresh the account balance from the source the current model implies. */
  const refreshBalance = async () => {
    const target = resolveBalanceTarget()
    state.balanceTarget = target
    if (target.kind === 'custom') {
      state.balance = await readCustomBalance(effectiveConfig().customBalance, ref => resolveSecret(ctx, ref))
      return
    }
    if (target.kind === 'deepseek') {
      const key = await resolveSecret(ctx, target.credentialRef)
      state.balance = await readDeepSeekBalance(key)
      return
    }
    state.balance = { ...emptyBalance(), currency: 'CNY', source: 'none', message: '当前渠道未提供余额接口' }
  }

  /** Refresh the live USD→CNY rate, keeping the configured fallback on failure. */
  const refreshFx = async () => {
    const live = await readFxRate()
    if (live === null) {
      state.fxLive = false
      return
    }
    state.fxRate = live.rate
    state.fxFetchedAt = live.fetchedAt
    state.fxLive = true
  }

  /** Run every stale refresh once, collapsing concurrent callers onto one run. */
  const ensureFresh = async (force) => {
    if (state.refreshing !== null) return await state.refreshing
    const run = (async () => {
      await loadCache()
      const tasks = []
      if (force || isCatalogStale()) tasks.push(refreshCatalog())
      if (force || isBalanceStale()) tasks.push(refreshBalance())
      if (force || isFxStale()) tasks.push(refreshFx())
      if (force || isDeepSeekStale()) tasks.push(refreshDeepSeek())
      await Promise.all(tasks)
    })()
    state.refreshing = run
    try {
      await run
    } finally {
      state.refreshing = null
    }
  }

  /** Project the harness LLM registry into configured rows, priced by channel. */
  const readConfiguredRows = async () => {
    if (Date.now() - state.configuredAt < CONFIGURED_TTL_MS) return state.configuredRows
    const llm = ctx.get('llm')
    if (llm === undefined) return state.configuredRows
    const selection = ctx.get('agentDefaultModel')?.currentSelection()
    const defaultProvider = typeof selection?.provider === 'string' ? selection.provider : ''
    const defaultModel = typeof selection?.model === 'string' ? selection.model : ''
    const hosts = providerHosts(ctx)
    const rows = []
    try {
      for (const provider of llm.listProviders()) {
        const providerId = String(provider?.id ?? '')
        if (providerId.length === 0) continue
        const providerName = String(provider?.name ?? providerId)
        const channel = resolveChannel(providerId, hosts.get(providerId) ?? '')
        let models = []
        try {
          models = await llm.listModels(providerId)
        } catch {
          continue
        }
        for (const model of models) {
          const modelId = String(model?.id ?? '')
          if (modelId.length === 0) continue
          const resolved = await llm.resolveModelInfo(providerId, modelId).catch(() => undefined)
          // Price the route the user actually bills through, then the owning
          // vendor's list price, then nothing this catalog knows about.
          const onChannel = findChannelRow(state.rows, channel, modelId)
          const owner = findRow(state.rows, channel, modelId)
          const hit = onChannel ?? owner
          const links = linksFor(channel.length > 0 ? channel : catalogProviderFor(providerId), hit?.doc ?? '')
          const row = hit === null
            ? localRow(catalogProviderFor(providerId), {
              id: modelId,
              name: model?.name,
              description: model?.description,
              inputModalities: model?.inputModalities,
              contextWindow: resolved?.contextWindow,
              maxTokens: resolved?.maxTokens ?? resolved?.defaultMaxTokens,
              reasoning: resolved?.reasoning !== undefined,
            }, links)
            : { ...hit, configured: true }
          row.configured = true
          row.isDefault = providerId === defaultProvider && modelId === defaultModel
          // The price channel is what the row already carries; the configured
          // route name is reported separately so the panel can name both.
          row.channelName = providerName === row.providerName ? '' : providerName
          row.priceFallback = hit !== null && onChannel === null
          rows.push(row)
        }
      }
    } catch {
      return state.configuredRows
    }
    rows.sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
    state.configuredRows = rows
    state.configuredAt = Date.now()
    return rows
  }

  /** The JSON-safe config projection sent to the browser. */
  const configState = () => {
    const config = effectiveConfig()
    return {
      currency: config.currency,
      fxRate: state.fxRate > 0 ? state.fxRate : config.fxRate,
      fxLive: state.fxLive,
      fxFetchedAt: state.fxFetchedAt,
      balanceRefreshMinutes: config.balanceRefreshMinutes,
      catalogTtlHours: config.catalogTtlHours,
      customBalance: { ...config.customBalance },
      domains: [...DOMAIN_TAGS],
      modalities: [...MODALITY_TAGS],
    }
  }

  /** Assemble the full panel snapshot from cached state. */
  const buildSnapshot = async () => {
    await loadCache()
    const configured = await readConfiguredRows()
    return {
      config: configState(),
      balance: { ...state.balance },
      catalog: {
        ...emptyCatalogState(),
        fetchedAt: state.catalogFetchedAt,
        count: state.rows.length,
        stale: isCatalogStale(),
        message: state.catalogMessage,
      },
      configured,
      featured: featuredRows(state.rows).slice(0, 40),
      sources: {
        balance: {
          kind: state.balanceTarget.kind,
          label: state.balanceTarget.label,
          url: state.balanceTarget.url,
          channel: state.balanceTarget.channel,
        },
        catalog: { label: CATALOG_SOURCE.label, url: CATALOG_SOURCE.url },
      },
      updatedAt: Date.now(),
    }
  }

  const service = {
    /** Cached snapshot; stale data triggers a background refresh. */
    async getSnapshot() {
      await loadCache()
      if (isCatalogStale() || isBalanceStale() || isFxStale()) void ensureFresh(false)
      return await buildSnapshot()
    },

    /** Force every source to refresh, then answer with the new snapshot. */
    async refresh() {
      await ensureFresh(true)
      state.configuredAt = 0
      return await buildSnapshot()
    },

    /** Re-read only the account balance — the footer chip's own action. */
    async refreshBalance() {
      await refreshBalance()
      return await buildSnapshot()
    },

    /** Search the full projection; facets alone filter the whole catalog. */
    async search(query, domains, modalities) {
      await loadCache()
      return {
        rows: searchRows(
          state.rows,
          typeof query === 'string' ? query : '',
          Array.isArray(domains) ? domains : [],
          Array.isArray(modalities) ? modalities : [],
        ),
      }
    },

    /** Patch and persist the configuration, then answer with the new snapshot. */
    async updateConfig(patch) {
      const current = effectiveConfig()
      const merged = normalizeConfig({
        ...current,
        ...(patch ?? {}),
        customBalance: { ...current.customBalance, ...(patch?.customBalance ?? {}) },
      })
      stored.value = merged
      await writeStoredConfig(merged)
      state.configuredAt = 0
      if (merged.customBalance.enabled) await refreshBalance()
      return await buildSnapshot()
    },
  }

  Object.defineProperty(service, 'typertRemote', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: { service, serviceKey: 'modelAdvisor', namespace: 'modelAdvisor' },
  })

  ctx.provide('modelAdvisor', service)

  ctx.effect(() => {
    void (async () => {
      const persisted = await readStoredConfig()
      if (Object.keys(persisted).length > 0) {
        // The panel's own writes win over composition defaults: the file is the
        // user's latest choice, the profile row only seeds a first run.
        stored.value = normalizeConfig({ ...stored.value, ...persisted })
      }
      await ensureFresh(false)
    })()
    return () => {
      // Nothing owns an external resource; the service dies with the fiber.
    }
  }, 'model-advisor: initial refresh')
}
