/**
 * Domain tagging and Chinese one-line summaries.
 *
 * Two different things live here and must not be mixed:
 *
 *   - **Strengths** (`tagsFor`): what a model is comparatively good at. These
 *     drive the filter chips, so a tag most models carry is worthless. The rules
 *     below were tuned against the catalog to land each tag in a 4–40% band;
 *     capability booleans (`tool_call`, `reasoning`, …) are deliberately NOT
 *     tags — 80%+ of models carry them, which is what made the first version's
 *     tags unreadable.
 *   - **Capabilities** (`summaryFor`): factual attributes rendered as one muted
 *     line — reasoning, tool calling, image input, context, open weights.
 */

/** Explicit tags for known model ids, keyed by lowercase substring. */
const CURATED = [
  { match: 'deepseek-reasoner', tags: ['数学', '代码 Agent'] },
  { match: 'qwq', tags: ['数学'] },
  { match: '-r1', tags: ['数学'] },
  { match: 'o3', tags: ['数学'] },
  { match: 'o4', tags: ['数学'] },
  { match: 'math', tags: ['数学'] },
]

/** Coding is table stakes for most models, so require it in the positioning. */
const CODING = /cod(e|ing)|program(mer|ming)?|software engineer|\bswe\b|refactor/i

/** Agentic, long-horizon coding — the narrower, more useful coding signal. */
const AGENTIC = /agentic|agent loop|coding agent|long[- ]horizon|tool[- ]use/i

/** Math and proof work. */
const MATH = /math|theorem|quantitative|proof|arithmetic/i

/** Chinese-language positioning, by vendor or by description. */
const CHINESE_VENDORS = new Set(['alibaba', 'zai', 'moonshotai', 'minimax', 'deepseek', 'tencent', 'xiaomi', 'meituan'])
const CHINESE_DESC = /chinese|bilingual|mandarin|中文/i

/** Context length at which a model is genuinely a long-document option. */
const LONG_CONTEXT = 1_000_000

/** Vision-capable input modalities as models.dev spells them. */
const VISION_MODALITIES = new Set(['image', 'pdf', 'audio', 'video'])

/** Canonical tag order; the filter chips follow it. */
export const DOMAIN_TAGS = ['代码 Agent', '数学', '中文写作', '长文', '高性价比', '开放权重']

/**
 * Derive the strength tags for one model. `高性价比` is added later by
 * {@link applyPriceTags} because it needs the whole catalog to rank against.
 * @param model - projected model row carrying id, description, provider, context.
 * @returns deduplicated tags in the canonical order.
 */
export function tagsFor(model) {
  const found = new Set()
  const description = typeof model.description === 'string' ? model.description : ''
  const haystack = `${model.id} ${model.family ?? ''} ${description}`.toLowerCase()

  for (const entry of CURATED) {
    if (haystack.includes(entry.match)) for (const tag of entry.tags) found.add(tag)
  }
  // Coding itself is table stakes for flagship models (two thirds of them are
  // positioned for it), so it is reported as positioning, not as a strength tag.
  if (AGENTIC.test(description) && CODING.test(description)) found.add('代码 Agent')
  if (MATH.test(description)) found.add('数学')
  if (CHINESE_VENDORS.has(model.provider) || CHINESE_DESC.test(description)) found.add('中文写作')
  if (Number(model.context) >= LONG_CONTEXT) found.add('长文')
  if (model.openWeights === true) found.add('开放权重')

  return DOMAIN_TAGS.filter(tag => found.has(tag))
}

/**
 * Add the relative `高性价比` tag: a model priced in the cheapest quartile of
 * its own peer group (reasoning vs non-reasoning), so the tag tracks value
 * rather than an absolute dollar threshold that drifts with the market.
 * @param rows - projected catalog rows, mutated in place.
 * @returns the same rows.
 */
export function applyPriceTags(rows) {
  for (const reasoning of [true, false]) {
    const peers = rows
      .filter(row => row.reasoning === reasoning && row.cost !== null)
      .map(row => row.cost.input + row.cost.output)
      .sort((left, right) => left - right)
    if (peers.length === 0) continue
    const threshold = peers[Math.floor(peers.length * 0.25)]
    for (const row of rows) {
      if (row.reasoning !== reasoning || row.cost === null) continue
      if (row.cost.input + row.cost.output > threshold) continue
      if (row.domains.includes('高性价比')) continue
      row.domains = DOMAIN_TAGS.filter(tag => tag === '高性价比' || row.domains.includes(tag))
    }
  }
  return rows
}

/** Render a token count as a compact label. */
function tokens(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

/**
 * Build the capability line for one model. Pricing is deliberately absent: the
 * row renders it in the chosen currency already.
 * @param model - projected model row.
 * @param tags - strength tags already derived for it.
 * @returns a short Chinese sentence describing factual capabilities.
 */
export function summaryFor(model, tags) {
  const parts = []
  if (CODING.test(typeof model.description === 'string' ? model.description : '')) parts.push('面向编码')
  if (model.reasoning === true) parts.push('带推理')
  if (model.toolCall === true) parts.push('支持工具调用')
  if (model.vision === true) parts.push('支持图像输入')
  const context = tokens(model.context)
  if (context.length > 0) parts.push(`${context} 上下文`)
  if (model.openWeights === true) parts.push('开放权重')
  if (parts.length === 0 && tags.length > 0) parts.push(`擅长${tags.slice(0, 2).join('、')}`)
  return parts.join(' · ')
}

/**
 * Filterable modalities, keyed by the `models.dev` spelling. Input and output
 * are separate namespaces so a model that accepts images and one that produces
 * them are not conflated.
 */
export const MODALITY_FILTERS = [
  { key: 'image-in', label: '图像输入', direction: 'input', modality: 'image' },
  { key: 'pdf-in', label: 'PDF 输入', direction: 'input', modality: 'pdf' },
  { key: 'video-in', label: '视频输入', direction: 'input', modality: 'video' },
  { key: 'audio-in', label: '音频输入', direction: 'input', modality: 'audio' },
  { key: 'image-out', label: '图像生成', direction: 'output', modality: 'image' },
  { key: 'audio-out', label: '音频生成', direction: 'output', modality: 'audio' },
]

/** Filterable modality labels, in display order. */
export const MODALITY_TAGS = MODALITY_FILTERS.map(entry => entry.label)

/** Whether one modalities list carries any vision-capable entry. */
export function hasVision(modalities) {
  if (!Array.isArray(modalities)) return false
  return modalities.some(entry => VISION_MODALITIES.has(String(entry).toLowerCase()))
}
