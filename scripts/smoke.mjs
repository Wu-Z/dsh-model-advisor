/**
 * Host-side smoke test: pure data modules, the Typert manifest validator, and
 * the service contract through a stub Cordis context. Not shipped.
 */

import { readCatalogCache, fetchCatalog, searchRows, featuredRows } from '../src/host/catalog.js'
import { tagsFor, summaryFor } from '../src/host/domains.js'
import { readFxRate } from '../src/host/balance.js'
import { apply } from '../lib/index.js'
import { TYPERT } from '../lib/typert.host.js'

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail.length > 0 ? ` — ${detail}` : ''}\n`)
}

// 1. catalog fetch + projection
let rows = []
try {
  const fetched = await fetchCatalog()
  rows = fetched.rows
  record('catalog fetch', rows.length > 1000, `${rows.length} rows`)
} catch (error) {
  const cached = await readCatalogCache()
  rows = cached.rows
  record('catalog fetch', false, `${String(error?.message ?? error)} (cache: ${rows.length} rows)`)
}

// 2. tagging
try {
  const sample = rows.find(row => row.id === 'deepseek-v4-pro') ?? rows[0]
  const tags = tagsFor(sample)
  record('tagging', tags.length > 0, `${sample.id} → ${tags.join('/')}`)
  record('summary', summaryFor(sample, tags).length > 0, summaryFor(sample, tags).slice(0, 60))
} catch (error) {
  record('tagging', false, String(error?.message ?? error))
}

// 3. search
try {
  const hits = searchRows(rows, 'deepseek')
  record('search', hits.length > 0, `${hits.length} hits, first=${hits[0]?.id ?? '-'}`)
  const featured = featuredRows(rows)
  record('featured', featured.length > 0, `${featured.length} rows`)
} catch (error) {
  record('search', false, String(error?.message ?? error))
}

// 4. fx
try {
  const fx = await readFxRate()
  record('fx rate', fx !== null, fx === null ? 'unavailable' : String(fx.rate))
} catch (error) {
  record('fx rate', false, String(error?.message ?? error))
}

// 5. typert manifest validation against the real loader
try {
  const loader = await import(
    '/Users/wuzebin/deepseek-harness/deepseek-harness/packages/typert/loader/lib/index.js'
  )
  const contribution = loader.validateTypertManifest('dsh-model-advisor', TYPERT)
  record('typert manifest', contribution.invocations.length === 5, `${contribution.invocations.length} invocations`)
} catch (error) {
  record('typert manifest', false, String(error?.message ?? error).split('\n')[0])
}

// 6. service through a stub context
try {
  const provided = new Map()
  const ctx = {
    get: key => (key === 'credentials'
      ? { resolve: async () => undefined }
      : undefined),
    provide: (key, value) => { provided.set(key, value) },
    effect: (fn) => { const disposer = fn(); void disposer },
    logger: { error: () => {}, warn: () => {}, info: () => {} },
  }
  apply(ctx, {})
  const service = provided.get('modelAdvisor')
  record('service provided', service !== undefined && service.typertRemote?.namespace === 'modelAdvisor')
  const snapshot = await service.refresh()
  record(
    'snapshot shape',
    typeof snapshot.balance?.ok === 'boolean'
      && Array.isArray(snapshot.featured)
      && Array.isArray(snapshot.configured)
      && typeof snapshot.config?.currency === 'string',
    `featured=${snapshot.featured.length} catalog=${snapshot.catalog.count}`,
  )
  const found = await service.search('claude')
  record('service search', Array.isArray(found.rows), `${found.rows.length} rows`)
  const updated = await service.updateConfig({ currency: 'CNY' })
  record('updateConfig', updated.config.currency === 'CNY', updated.config.currency)
  // JSON-safety: the gateway rejects an explicit undefined anywhere.
  const json = JSON.stringify(snapshot)
  record('json safe', !json.includes('undefined'), `${json.length} bytes`)
} catch (error) {
  record('service', false, `${String(error?.message ?? error)}`)
}


// 7. channel pricing: the configured route decides which channel's price wins
try {
  const provided = new Map()
  const ctx = {
    get: (key) => {
      if (key === 'credentials') return { resolve: async () => undefined }
      if (key === 'settings') {
        return {
          get: (ns) => (ns === 'llm-pi-ai'
            ? {
              providers: {
                'my-openrouter': { baseURL: 'https://openrouter.ai/api/v1' },
                'my-gateway': { baseURL: 'https://gateway.internal/v1' },
              },
            }
            : undefined),
        }
      }
      if (key === 'llm') {
        return {
          listProviders: () => [
            { id: 'my-openrouter', name: '我的中转' },
            { id: 'my-gateway', name: '内部网关' },
          ],
          listModels: async (provider) => (provider === 'my-openrouter'
            ? [{ id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' }]
            : [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }]),
          resolveModelInfo: async () => ({ contextWindow: 200000, maxTokens: 64000 }),
        }
      }
      return undefined
    },
    provide: (key, value) => { provided.set(key, value) },
    effect: (fn) => { void fn() },
    logger: { error: () => {}, warn: () => {}, info: () => {} },
  }
  apply(ctx, {})
  const snapshot = await provided.get('modelAdvisor').refresh()
  const viaHost = snapshot.configured.find(row => row.provider === 'openrouter')
  const fallback = snapshot.configured.find(row => row.provider === 'anthropic')
  record('channel by baseURL host', viaHost !== undefined && viaHost.priceFallback === false,
    viaHost === undefined ? 'no openrouter row' : `${viaHost.id} via ${viaHost.providerName}, channel=${viaHost.channelName}`)
  record('unknown channel falls back', fallback !== undefined && fallback.priceFallback === true,
    fallback === undefined ? 'no fallback row' : `${fallback.id} via ${fallback.providerName}, channel=${fallback.channelName}`)
} catch (error) {
  record('channel pricing', false, String(error?.message ?? error))
}


// 8. official DeepSeek two-tier pricing replaces the stale models.dev number
try {
  const provided = new Map()
  const ctx = {
    get: key => (key === 'credentials' ? { resolve: async () => undefined } : undefined),
    provide: (key, value) => { provided.set(key, value) },
    effect: (fn) => { void fn() },
    logger: { error: () => {}, warn: () => {}, info: () => {} },
  }
  apply(ctx, {})
  const snapshot = await provided.get('modelAdvisor').refresh()
  const flash = snapshot.featured.find(row => row.provider === 'deepseek' && row.id === 'deepseek-v4-flash')
  const pro = snapshot.featured.find(row => row.provider === 'deepseek' && row.id === 'deepseek-v4-pro')
  record('deepseek tiers attached', Array.isArray(flash?.tiers) && flash.tiers.length === 2,
    flash === undefined ? 'no flash row' : JSON.stringify(flash.tiers?.[0] ?? null))
  record('deepseek off-peak headline', flash !== undefined && flash.cost.input === 0.22 && flash.cost.output === 0.66,
    flash === undefined ? '' : `cost=${flash.cost.input}/${flash.cost.output}`)
  record('deepseek peak tier', flash !== undefined && flash.tiers[1].output === 1.32 && flash.tiers[1].outputCny === 9,
    flash === undefined ? '' : `${flash.tiers[1].output} / ¥${flash.tiers[1].outputCny}`)
  record('deepseek pro native cny', pro !== undefined && pro.tiers[1].outputCny === 27,
    pro === undefined ? '' : String(pro.tiers?.[1]?.outputCny))
  const nonDeepSeek = snapshot.featured.find(row => row.provider !== 'deepseek')
  record('other providers keep single price', nonDeepSeek !== undefined && nonDeepSeek.tiers === null)
  // 9. tag discrimination: the fix that made 擅长领域 readable
  // Tag discrimination is measured over the deduped first-party catalog, not
  // the featured subset (which is biased toward new 1M-context flagships).
  const { rows: all } = await readCatalogCache()
  const FIRST_PARTY = new Set(['anthropic', 'openai', 'google', 'deepseek', 'xai', 'mistral', 'moonshotai', 'zai', 'minimax', 'alibaba', 'cohere', 'meta'])
  const bare = id => id.toLowerCase().replace(/^.*\//, '').replace(/[^a-z0-9]/g, '')
  const byId = new Map()
  for (const row of all) {
    const key = bare(row.id)
    const current = byId.get(key)
    if (current === undefined) byId.set(key, row)
    else if (FIRST_PARTY.has(row.provider) && !FIRST_PARTY.has(current.provider)) byId.set(key, row)
  }
  const rows = [...byId.values()].filter(row => FIRST_PARTY.has(row.provider))
  const avg = rows.reduce((sum, row) => sum + row.domains.length, 0) / rows.length
  const tagNames = [...new Set(rows.flatMap(row => row.domains))]
  const broadest = Math.max(...tagNames.map(tag => rows.filter(row => row.domains.includes(tag)).length / rows.length))
  record('tags discriminate', avg <= 2.0 && broadest <= 0.6,
    `avg=${avg.toFixed(2)} broadest=${(broadest * 100).toFixed(0)}%`)

} catch (error) {
  record('deepseek tiers', false, String(error?.message ?? error))
}


// 10. a domain filter alone must search the whole catalog, not the featured page
try {
  const provided = new Map()
  const ctx = {
    get: key => (key === 'credentials' ? { resolve: async () => undefined } : undefined),
    provide: (key, value) => { provided.set(key, value) },
    effect: (fn) => { void fn() },
    logger: { error: () => {}, warn: () => {}, info: () => {} },
  }
  apply(ctx, {})
  const service = provided.get('modelAdvisor')
  await service.refresh()
  const math = await service.search('', ['数学'], [])
  const official = math.rows.filter(row => ['openai', 'google', 'deepseek', 'anthropic', 'mistral', 'alibaba'].includes(row.provider))
  record('domain filter searches whole catalog', math.rows.length > 0 && official.length > 0,
    `${math.rows.length} rows, ${official.length} official; first=${math.rows[0]?.id ?? '-'}`)
  const searched = await service.search('deepseek', [], [])
  record('search still works', searched.rows.length > 0, `${searched.rows.length} rows`)

  // Facets: OR within a group, AND across groups.
  const either = await service.search('', ['数学', '中文写作'], [])
  const both = await service.search('', ['代码 Agent'], ['图像输入'])
  const modalityOnly = await service.search('', [], ['图像输入', '音频输入'])
  const imageOut = await service.search('', [], ['图像生成'])
  record('facet OR within group', either.rows.length > 0, `${either.rows.length} rows`)
  record('facet AND across groups', both.rows.length > 0, `${both.rows.length} rows`)
  record('modality OR', modalityOnly.rows.length > 0, `${modalityOnly.rows.length} rows`)
  record('output modality filter', imageOut.rows.length > 0, `${imageOut.rows.length} rows`)
  record('open weights tag', (await service.search('', ['开放权重'], [])).rows.length > 0, '')
} catch (error) {
  record('domain filter', false, String(error?.message ?? error))
}


// 11. data sources: the balance source follows the selected model's channel
try {
  const provided = new Map()
  const ctx = {
    get: (key) => {
      if (key === 'credentials') return { resolve: async () => undefined }
      if (key === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-pro' }) }
      return undefined
    },
    provide: (key, value) => { provided.set(key, value) },
    effect: (fn) => { void fn() },
    logger: { error: () => {}, warn: () => {}, info: () => {} },
  }
  apply(ctx, {})
  const service = provided.get('modelAdvisor')
  const snapshot = await service.refreshBalance()
  record('balance source follows model', snapshot.sources.balance.kind === 'deepseek'
    && snapshot.sources.balance.channel === 'deepseek', JSON.stringify(snapshot.sources.balance))
  record('catalog source credited', snapshot.sources.catalog.label === 'models.dev'
    && snapshot.sources.catalog.url === 'https://models.dev', JSON.stringify(snapshot.sources.catalog))

  // A model on a channel with no balance API must say so, not show DeepSeek's number.
  const other = new Map()
  const otherCtx = {
    get: (key) => {
      if (key === 'credentials') return { resolve: async () => undefined }
      if (key === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'my-gateway', model: 'claude-sonnet-4-6' }) }
      return undefined
    },
    provide: (key, value) => { other.set(key, value) },
    effect: (fn) => { void fn() },
    logger: { error: () => {}, warn: () => {}, info: () => {} },
  }
  apply(otherCtx, {})
  const otherSnapshot = await other.get('modelAdvisor').refreshBalance()
  record('unknown channel reports no balance API',
    otherSnapshot.sources.balance.kind === 'none' && otherSnapshot.balance.ok === false,
    JSON.stringify(otherSnapshot.sources.balance))
} catch (error) {
  record('data sources', false, String(error?.message ?? error))
}


// 12. subscription-plan channels report 0/0 upstream: that is "not priced",
//     never a free model, and must not win the cheapest-price tag.
try {
  const { rows: all } = await readCatalogCache()
  const plan = all.find(row => row.provider === 'alibaba-token-plan' && row.id === 'wan2.7-image-pro')
  record('zero price reads as unlisted', plan !== undefined && plan.cost === null,
    plan === undefined ? 'row missing' : JSON.stringify(plan.cost))
  const bogus = all.filter(row => row.cost === null && row.domains.includes('高性价比'))
  record('unpriced rows never win 高性价比', bogus.length === 0, `${bogus.length} bogus`)
  const priced = all.filter(row => row.cost !== null).length
  record('priced rows remain', priced > 6000, `${priced} priced`)
} catch (error) {
  record('zero-price handling', false, String(error?.message ?? error))
}


// 13. Unpriced rows say WHY: reference price from a twin channel, subscription
//     plan, explicitly free variant, or genuinely unknown.
try {
  const { rows: all } = await readCatalogCache()
  const kinds = {}
  for (const row of all) kinds[row.priceKind] = (kinds[row.priceKind] ?? 0) + 1
  record('price kinds classified', (kinds.listed ?? 0) > 6000 && (kinds.reference ?? 0) > 0 && (kinds.plan ?? 0) > 0,
    JSON.stringify(kinds))
  const reference = all.filter(row => row.priceKind === 'reference')
  record('reference keeps cost null', reference.every(row => row.cost === null && row.priceRef !== null),
    `${reference.length} rows`)
  record('reference never wins 高性价比', reference.every(row => !row.domains.includes('高性价比')))
  const plan = all.find(row => row.provider === 'alibaba-token-plan' && row.id === 'qwen-image-2.0-pro')
  record('plan channel labelled', plan !== undefined && plan.priceKind === 'plan', plan?.priceKind ?? 'missing')
  const free = all.find(row => /:free$/.test(row.id))
  record('free variant labelled', free !== undefined && free.priceKind === 'free', free?.priceKind ?? 'missing')
  const gateway = all.find(row => row.provider === 'kilo' && row.id === 'openrouter/auto')
  record('gateway borrows a twin price', gateway !== undefined && gateway.priceKind === 'reference'
    && gateway.priceRef.providerName.length > 0, gateway === undefined ? 'missing' : gateway.priceRef.providerName)
} catch (error) {
  record('price kinds', false, String(error?.message ?? error))
}

const failed = results.filter(entry => !entry.ok)
process.stdout.write(`\n${results.length - failed.length}/${results.length} passed\n`)
process.exit(failed.length === 0 ? 0 : 1)
