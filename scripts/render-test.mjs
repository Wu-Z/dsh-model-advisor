/**
 * Render-layer test: load the built browser bundle, invoke its `apply` against
 * a stub client context, and server-render the registered component in every
 * state the panel can be in. `createPortal` is shimmed to render inline so the
 * popover body is actually exercised. Catches render-time crashes without a
 * browser. Not shipped.
 */

import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
import * as ReactDom from 'react-dom'

const require = createRequire(import.meta.url)

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail.length > 0 ? ` — ${detail}` : ''}\n`)
}

/** Every icon/primitive resolves to a marker element under the test. */
const primitivesStub = new Proxy({}, {
  get: (_target, name) => () => React.createElement('span', { 'data-primitive': String(name) }),
})

/** Resolve the bundle's externals; portals render inline under the test. */
const bundleRequire = (spec) => {
  if (spec === 'react') return React
  if (spec === 'react-dom') return { ...ReactDom, createPortal: node => node }
  if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub
  throw new Error(`unexpected external in the browser bundle: ${spec}`)
}

// 1. capture the bundle's module registration
let registration = null
const injectedStyles = []
globalThis.document = {
  body: {},
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: { appendChild: element => injectedStyles.push(element) },
  addEventListener: () => {},
  removeEventListener: () => {},
}
globalThis.window = {
  __ModuleLoader__: { load: (value) => { registration = value } },
  addEventListener: () => {},
  removeEventListener: () => {},
}
await import('../lib/client.js')
check('bundle registers', registration !== null && registration.id === 'dsh-model-advisor')

const exported = registration.factory(bundleRequire)
check('bundle exports', typeof exported.apply === 'function' && Array.isArray(exported.inject),
  `inject=${JSON.stringify(exported.inject)}`)

// 2. run apply against a stub context and capture the slot registration
let slot = null
const ctx = {
  effect: (fn) => { const disposer = typeof fn === 'function' ? fn() : undefined; void disposer },
  locale: { register: () => () => {} },
  remote: { $mount: async () => () => {} },
  slots: {
    inject: (_name, callback) => { callback() },
    register: (declaration, component) => {
      slot = { declaration, component }
      return () => {}
    },
  },
  get: () => undefined,
}
await exported.apply(ctx)
check('slot registered', slot !== null && slot.declaration.name === 'sidebar.footer.action',
  slot === null ? 'missing' : `id=${slot.declaration.id} order=${slot.declaration.order}`)

check('stylesheet injected', injectedStyles.length === 1
  && injectedStyles[0].dataset.plugin === 'dsh-model-advisor'
  && injectedStyles[0].textContent.includes('--dsw-alias-')
  && !/\.ma-[a-z-]+\s*\{[^}]*#[0-9a-fA-F]{6}(?!\s*,)/.test(injectedStyles[0].textContent.replace(/var\([^)]*\)/g, '')),
  `${injectedStyles.length} sheet(s), ${injectedStyles[0]?.textContent.length ?? 0} bytes`)

check('balance hugs the toggle', /\.ma-balance-btn\s*\{[^}]*flex:\s*0 1 auto/.test(injectedStyles[0].textContent))

const Component = slot.component
const TEMPLATES = {
  'panel.catalog': '{count} models · updated {time}',
  'panel.catalog.error': 'catalog failed: {message}',
  'panel.fx.live': 'live {rate}',
  'panel.fx.fixed': 'fixed {rate}',
  'panel.balance.updated': 'updated {time}',
  'panel.channel': '渠道 {name}',
  'panel.price.offPeak': '谷时',
  'panel.price.peak': '峰时',
  'panel.price.now': '当前',
  'panel.col.model': '模型',
  'panel.col.domains': '擅长',
  'panel.col.price': '价格',
  'panel.sort': '排序',
  'panel.sort.default': '默认',
  'panel.sort.priceAsc': '价格 ↑',
  'panel.sort.priceDesc': '价格 ↓',
  'panel.sort.price': '价格',
  'panel.sort.release': '最新',
  'panel.sources': '数据来源',
  'panel.sources.balance': '余额',
  'panel.sources.catalog': '模型列表',
  'panel.sources.none': '当前渠道未提供余额接口',
  'panel.currency': '显示币种',
  'panel.filter.domains': '擅长',
  'panel.filter.modalities': '模态',
  'panel.filter.clear': '清除筛选',
  'panel.price.reference': '参考 {provider} 挂牌价',
  'panel.price.plan': '套餐内',
  'panel.price.free': '免费',
  'panel.balance.unknown': '余额未知',
  'panel.balance.noApi': '该渠道未提供余额接口',
}
const t = key => TEMPLATES[key] ?? key

/** Build a fake store whose snapshot is the given state. */
function fakeStore(state) {
  return {
    subscribe: () => () => {},
    getSnapshot: () => state,
    getServerSnapshot: () => state,
    ensureLoaded: () => {},
    refresh: () => {},
    toggleOpen: () => {},
    close: () => {},
    setQuery: () => {},
    setDomain: () => {},
    setCurrency: () => {},
    openSettingsDocument: () => {},
  }
}

const row = {
  key: 'deepseek/deepseek-v4-pro',
  provider: 'deepseek-official',
  providerName: 'DeepSeek',
  id: 'deepseek-v4-pro',
  name: 'DeepSeek V4 Pro',
  family: 'deepseek',
  description: 'Open MoE flagship',
  summary: '擅长写代码、推理、工具调用 · 带推理 · 1M 上下文 · $0.435 / $0.87 每百万 token',
  domains: ['写代码', '推理', '工具调用', '长文'],
  reasoning: true,
  toolCall: true,
  vision: false,
  inputModalities: ['text'],
  outputModalities: ['text'],
  openWeights: true,
  context: 1000000,
  maxOutput: 384000,
  cost: { input: 0.435, output: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
  releaseDate: '2026-05-01',
  configured: true,
  isDefault: true,
  channelName: '',
  priceFallback: false,
  tiers: null,
  source: 'catalog',
}

const localRow = {
  ...row,
  key: 'deepseek-official/deepseek-v4.1-flash-expires-on-0910',
  id: 'deepseek-v4.1-flash-expires-on-0910',
  name: 'DeepSeek-V4.1-Flash（内测，9/10 到期）',
  cost: null,
  configured: true,
  isDefault: false,
  channelName: 'DeepSeek',
  priceFallback: false,
  tiers: null,
  source: 'local',
  domains: ['写代码', '多模态', '高性价比'],
  summary: '擅长写代码、多模态 · 带推理 · 1M 上下文',
}

const fallbackRow = {
  ...row,
  key: 'anthropic/claude-sonnet-4-6',
  provider: 'anthropic',
  providerName: 'Anthropic',
  id: 'claude-sonnet-4-6',
  name: 'Claude Sonnet 4.6',
  configured: true,
  isDefault: false,
  channelName: '我的网关',
  priceFallback: true,
  tiers: null,
  cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
}

const tieredRow = {
  ...row,
  key: 'deepseek/deepseek-v4-flash',
  provider: 'deepseek',
  providerName: 'DeepSeek',
  id: 'deepseek-v4-flash',
  name: 'DeepSeek V4 Flash',
  isDefault: false,
  domains: ['写代码', '代码 Agent', '中文写作', '长文'],
  summary: '带推理 · 支持工具调用 · 1M 上下文',
  cost: { input: 0.22, output: 0.66, cacheRead: 0.007, cacheWrite: 0 },
  tiers: [
    { key: 'offPeak', input: 0.22, output: 0.66, cacheRead: 0.007, inputCny: 1.5, outputCny: 4.5, cacheReadCny: 0.05 },
    { key: 'peak', input: 0.44, output: 1.32, cacheRead: 0.014, inputCny: 3, outputCny: 9, cacheReadCny: 0.1 },
  ],
}

const referenceRow = {
  ...row,
  key: 'kilo/openrouter/auto',
  provider: 'kilo',
  providerName: 'Kilo Gateway',
  id: 'openrouter/auto',
  name: 'Auto Router',
  cost: null,
  priceKind: 'reference',
  priceRef: { input: 0.85, output: 1.55, cacheRead: 0, providerName: 'Morph' },
  configured: false,
  isDefault: false,
  channelName: '',
  domains: ['长文'],
  source: 'catalog',
}

const planRow = {
  ...referenceRow,
  key: 'alibaba-token-plan/qwen-image-2.0-pro',
  provider: 'alibaba-token-plan',
  providerName: 'Alibaba Token Plan',
  id: 'qwen-image-2.0-pro',
  name: 'Qwen Image 2.0 Pro',
  priceKind: 'plan',
  priceRef: null,
}

const noBalanceState = {
  phase: 'ready',
  error: '',
  open: true,
  busy: false,
  balanceBusy: false,
  query: '',
  domains: [],
  modalities: [],
  searching: false,
  currency: 'CNY',
  rows: [],
  data: {
    config: {
      currency: 'USD', fxRate: 6.728, fxLive: true, fxFetchedAt: Date.now(),
      balanceRefreshMinutes: 5, catalogTtlHours: 6,
      customBalance: { enabled: false, url: '', method: 'GET', headerName: 'Authorization', credentialRef: '', path: '', currency: 'USD' },
      domains: [], modalities: [],
    },
    balance: { ok: false, currency: 'CNY', total: 0, granted: 0, toppedUp: 0, source: 'none', message: '当前渠道未提供余额接口', fetchedAt: 0 },
    catalog: { fetchedAt: Date.now(), count: 7612, stale: false, message: '' },
    configured: [], featured: [],
    sources: { balance: { kind: 'none', label: '', url: '', channel: 'moonshotai' }, catalog: { label: 'models.dev', url: 'https://models.dev' } },
    updatedAt: Date.now(),
  },
}

const readyState = {
  phase: 'ready',
  error: '',
  open: true,
  busy: false,
  query: '',
  domains: [],
  modalities: [],
  searching: false,
  currency: 'CNY',
  rows: [row, tieredRow, fallbackRow, localRow, referenceRow, planRow],
  data: {
    config: {
      currency: 'USD',
      fxRate: 6.73,
      fxLive: true,
      fxFetchedAt: Date.now(),
      balanceRefreshMinutes: 5,
      catalogTtlHours: 6,
      customBalance: {
        enabled: false, url: '', method: 'GET', headerName: 'Authorization',
        credentialRef: '', path: '', currency: 'USD',
      },
      domains: ['代码 Agent', '数学', '中文写作', '长文', '高性价比', '开放权重'],
      modalities: ['图像输入', 'PDF 输入', '视频输入', '音频输入', '图像生成', '音频生成'],
    },
    balance: {
      ok: true, currency: 'CNY', total: 41.21, granted: 0, toppedUp: 41.21,
      source: 'deepseek', message: '', fetchedAt: Date.now(),
    },
    catalog: { fetchedAt: Date.now(), count: 7612, stale: false, message: '' },
    configured: [row, localRow],
    featured: [row],
    sources: {
      balance: { kind: 'deepseek', label: 'DeepSeek 官方余额接口', url: 'https://platform.deepseek.com/usage', channel: 'deepseek' },
      catalog: { label: 'models.dev', url: 'https://models.dev' },
    },
    updatedAt: Date.now(),
  },
}

const render = state => renderToStaticMarkup(
  React.createElement(Component, { advisor: fakeStore(state), wide: true, t }),
)

// 3. the footer action in both widths, panel closed
for (const wide of [true, false]) {
  try {
    const html = render({ ...readyState, open: false })
    const buttons = (html.match(/<button/g) ?? []).length
    const ok = html.includes('¥41.21') && buttons === 2 && !html.includes('◈')
    check(`corner renders (wide=${String(wide)})`, ok,
      ok ? `${buttons} buttons` : `${buttons} buttons; ${html.slice(0, 140)}`)
  } catch (error) {
    check(`corner renders (wide=${String(wide)})`, false, String(error?.message ?? error))
  }
}

// 4. the open panel: balance, tags, prices, links, currency and the local row
try {
  const html = render(readyState)
  const expectations = [
    ['balance total', '¥41.21'],
    ['model name', 'DeepSeek V4 Pro'],
    ['domain tag', '写代码'],
    ['usd→cny price', '¥2.92'],
    ['local model row', 'deepseek-v4.1-flash-expires-on-0910'],
    ['unknown price label', 'panel.price.unknown'],
    ['unknown price hint', 'panel.price.unknownHint'],
    ['reference price note', '参考 Morph 挂牌价'],
    ['reference price value', '¥5.72'],
    ['plan price label', '套餐内'],
    ['catalog count', '7612'],
    ['channel name', '渠道 我的网关'],
    ['peak tier label', '峰时'],
    ['off-peak tier label', '谷时'],
    ['native cny tier price', '¥1.5'],
    ['peak cny tier price', '¥9'],
    ['table header model', '模型'],
    ['table header strengths', '擅长'],
    ['table header price', '价格'],
    ['sort control price', '价格'],
    ['modality filter row', '模态'],
    ['modality chip image', '图像输入'],
    ['modality chip image generation', '图像生成'],
    ['strength filter row', '擅长'],
    ['table classes', 'ma-row'],
    ['panel classes', 'ma-panel'],
    ['source row label', '数据来源'],
    ['balance source link', 'https://platform.deepseek.com/usage'],
    ['catalog source link', 'https://models.dev'],
    ['currency segmented control', 'ma-seg'],
    ['currency options', 'aria-pressed'],
    ['fallback marker', 'panel.price.fallback'],
  ]
  for (const [label, needle] of expectations) {
    check(`panel shows ${label}`, html.includes(needle), html.includes(needle) ? '' : `missing "${needle}"`)
  }
  // The visible meta line is short; capabilities ride the row tooltip instead.
  check('meta line trimmed', !html.includes('DeepSeek · 1M 上下文 · 面向编码'), '')
  const tooltips = [...html.matchAll(/title="([^"]*)"/g)].map(match => match[1])
  check('capabilities in tooltip', tooltips.some(value => value.includes('带推理')),
    `${tooltips.length} tooltips`)
} catch (error) {
  check('panel renders', false, String(error?.message ?? error))
}

// 4b. a channel with no balance API reads as a quiet "unknown", not a shout
try {
  const html = render(noBalanceState)
  const quiet = html.includes('ma-amount is-unknown')
  check('unknown balance is quiet', quiet && html.includes('余额未知') && html.includes('该渠道未提供余额接口'),
    quiet ? '' : html.slice(0, 160))
  // The long reason now appears once, in the small footer source row only.
  const reasonCount = (html.match(/当前渠道未提供余额接口/g) ?? []).length
  check('unknown balance not duplicated', reasonCount === 1, `${reasonCount} occurrence(s)`)
} catch (error) {
  check('unknown balance', false, String(error?.message ?? error))
}

// 5. degraded states must not throw
for (const [label, state] of [
  ['loading', { ...readyState, phase: 'loading', data: null, rows: [] }],
  ['error', { ...readyState, phase: 'error', data: null, rows: [], error: 'boom' }],
  ['empty rows', { ...readyState, rows: [] }],
  ['balance failed', { ...readyState, data: { ...readyState.data, balance: { ...readyState.data.balance, ok: false, message: '未配置 DEEPSEEK_API_KEY' } } }],
  ['catalog error', { ...readyState, data: { ...readyState.data, catalog: { ...readyState.data.catalog, message: 'HTTP 503' } } }],
]) {
  try {
    const html = render(state)
    check(`panel state=${label}`, html.length > 0, `${html.length} bytes`)
  } catch (error) {
    check(`panel state=${label}`, false, String(error?.message ?? error))
  }
}


// 6. sorting: unpriced rows sink, directions are correct
try {
  const { sortRows, priceValue } = await import('../src/client/sort.js')
  const cheap = { key: 'a', cost: { input: 1, output: 2 }, tiers: null, context: 100, releaseDate: '2026-01-01' }
  const dear = { key: 'b', cost: { input: 9, output: 18 }, tiers: null, context: 300, releaseDate: '2026-06-01' }
  const tiered = { key: 'c', cost: { input: 5, output: 10 }, tiers: [{ output: 0.5 }], context: 200, releaseDate: '2026-03-01' }
  const free = { key: 'd', cost: null, tiers: null, context: 50, releaseDate: '2025-01-01' }
  const asc = sortRows([dear, free, cheap, tiered], 'priceAsc').map(row => row.key)
  const desc = sortRows([dear, free, cheap, tiered], 'priceDesc').map(row => row.key)
  const release = sortRows([dear, free, cheap, tiered], 'release').map(row => row.key)
  check('sort price asc, unpriced last', asc.join('') === 'cabd', asc.join(''))
  check('sort price desc, unpriced last', desc.join('') === 'bacd', desc.join(''))
  check('sort release desc', release.join('') === 'bcad', release.join(''))
  check('tier price wins over list price', priceValue(tiered) === 0.5, String(priceValue(tiered)))
  // The context sort was removed: an unknown key leaves the input order alone.
  check('context sort removed', sortRows([dear, free, cheap, tiered], 'context').map(row => row.key).join('') === 'bdac')
} catch (error) {
  check('sorting', false, String(error?.message ?? error))
}

const failed = results.filter(ok => !ok).length
process.stdout.write(`\n${results.length - failed}/${results.length} passed\n`)
process.exit(failed === 0 ? 0 : 1)
