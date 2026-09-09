/**
 * The model advisor popover, laid out as a three-column comparison table:
 * 模型 | 擅长 | 价格. Secondary facts (provider, context, capabilities) ride a
 * muted second line so the columns stay scannable and the price column lines up
 * down the whole list. Styling lives in the injected stylesheet (`styles.js`),
 * which is what makes hover, focus and motion states possible.
 */

import * as React from 'react'
import {
  IconCloseOutline16,
  IconRefreshOutline16,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { currentTier, formatAmount, formatMoney, formatPrice, formatTokens, formatWhen } from './format.js'
import { sortRows } from './sort.js'

const PANEL_WIDTH = 560

/** Sort options offered above the list; price is one button that flips direction. */
const SORTS = [
  ['default', 'panel.sort.default'],
  ['price', 'panel.sort.price'],
  ['release', 'panel.sort.release'],
]

/** Next sort state for one button press, flipping the price direction. */
function nextSort(current, key) {
  if (key !== 'price') return current === key ? 'default' : key
  if (current === 'priceAsc') return 'priceDesc'
  if (current === 'priceDesc') return 'priceAsc'
  return 'priceAsc'
}

/** Label key for one sort button in the current state. */
function sortLabelKey(current, key) {
  if (key !== 'price') return key === 'default' ? 'panel.sort.default' : 'panel.sort.release'
  if (current === 'priceAsc') return 'panel.sort.priceAsc'
  if (current === 'priceDesc') return 'panel.sort.priceDesc'
  return 'panel.sort.price'
}

/** Whether one sort button reads as active. */
function sortActive(current, key) {
  if (key === 'price') return current === 'priceAsc' || current === 'priceDesc'
  return current === key
}

/** Number of placeholder rows shown while the first snapshot loads. */
const SKELETON_ROWS = 6

/** Host-side result cap; the list says so when it is hit. */
const SEARCH_LIMIT = 40

/** Interpolate `{name}` placeholders in a dictionary string. */
function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
}

/**
 * The price cell for a row the channel does not price. The label states WHY:
 * a reference price borrowed from another channel, a subscription plan, an
 * explicitly free variant, or genuinely unknown.
 */
function UnpricedCell({ row, currency, fxRate, t }) {
  if (row.priceKind === 'reference' && row.priceRef !== null) {
    return (
      <div className="ma-price" title={fill(t('panel.price.referenceHint'), { provider: row.priceRef.providerName })}>
        <div>{t('panel.price.input')} {formatPrice(row.priceRef.input, currency, fxRate)}</div>
        <div>{t('panel.price.output')} {formatPrice(row.priceRef.output, currency, fxRate)}</div>
        <div className="ma-price-note">{fill(t('panel.price.reference'), { provider: row.priceRef.providerName })}</div>
      </div>
    )
  }
  if (row.priceKind === 'plan') {
    return <div className="ma-price" title={t('panel.price.planHint')}>{t('panel.price.plan')}</div>
  }
  if (row.priceKind === 'free') {
    return <div className="ma-price" title={t('panel.price.freeHint')}>{t('panel.price.free')}</div>
  }
  return <div className="ma-price" title={t('panel.price.unknownHint')}>{t('panel.price.unknown')}</div>
}

/** One model row, laid out on the shared column grid. */
function ModelRow({ row, currency, fxRate, t }) {
  const tierNow = currentTier()
  const provider = row.providerName.length > 0 ? row.providerName : row.provider
  const channel = typeof row.channelName === 'string' ? row.channelName : ''
  const meta = [
    provider,
    row.context > 0 ? `${formatTokens(row.context)} 上下文` : '',
    // A local row's display name may not contain its id, which is what the user
    // types in Settings, so show the id for those rows.
    row.source === 'local' ? row.id : '',
    // Name the configured route when it differs from the price channel.
    channel.length > 0 && channel !== provider ? fill(t('panel.channel'), { name: channel }) : '',
  ]
    .filter(part => part.length > 0)
    .join(' · ')
  // Capabilities and the upstream positioning live on hover, so the visible
  // line stays short and never truncates mid-sentence.
  const tooltip = [row.description, row.summary].filter(part => part.length > 0).join('\n')

  return (
    <div className="ma-row" title={tooltip}>
      <div className="ma-row-name">
        <span>{row.name}</span>
        {row.isDefault && <span className="ma-badge is-current">{t('panel.current')}</span>}
        {row.configured && !row.isDefault && <span className="ma-badge">{t('panel.configured')}</span>}
        {row.source === 'local' && <span className="ma-badge">{t('panel.local')}</span>}
      </div>

      <div className="ma-row-tags">
        {row.domains.map(tag => <span key={tag} className="ma-tag">{tag}</span>)}
      </div>

      <div className="ma-row-price">
        {Array.isArray(row.tiers) && row.tiers.length > 0
          ? (
            <div className="ma-price" title={t('panel.price.tiers')}>
              {row.tiers.map((tier) => {
                const active = tier.key === tierNow
                const input = currency === 'CNY'
                  ? (tier.inputCny > 0 ? tier.inputCny : tier.input * fxRate)
                  : tier.input
                const output = currency === 'CNY'
                  ? (tier.outputCny > 0 ? tier.outputCny : tier.output * fxRate)
                  : tier.output
                return (
                  <div key={tier.key} className={active ? 'ma-tier is-active' : 'ma-tier'}>
                    {tier.key === 'peak' ? t('panel.price.peak') : t('panel.price.offPeak')}
                    {' '}
                    {formatAmount(input, currency)} / {formatAmount(output, currency)}
                    {active ? ` ${t('panel.price.now')}` : ''}
                  </div>
                )
              })}
            </div>
          )
          : row.cost === null
            ? <UnpricedCell row={row} currency={currency} fxRate={fxRate} t={t} />
            : (
              <div className="ma-price" title={t('panel.price.hint')}>
                <div>{t('panel.price.input')} {formatPrice(row.cost.input, currency, fxRate)}</div>
                <div>{t('panel.price.output')} {formatPrice(row.cost.output, currency, fxRate)}</div>
                {row.priceFallback === true && <div className="ma-price-note">{t('panel.price.fallback')}</div>}
              </div>
            )}
      </div>

      <div className="ma-row-meta">{meta}</div>
    </div>
  )
}

/** Placeholder rows for the first load, so the panel is never a blank box. */
function Skeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div className="ma-skeleton-row" key={index}>
          <span className="ma-skeleton-bar" style={{ width: `${58 + (index % 3) * 12}%` }} />
          <span className="ma-skeleton-bar" style={{ width: '72%' }} />
          <span className="ma-skeleton-bar" style={{ width: '64%', justifySelf: 'end' }} />
        </div>
      ))}
    </div>
  )
}

/**
 * Render the panel body.
 * @param props - store state, handlers, anchor rectangle and translator.
 */
export function Panel({
  state, t, anchor, onRefresh, onClose, onSearch, onDomain, onModality, onClearFilters, onCurrency,
}) {
  const inputRef = React.useRef(null)
  const panelRef = React.useRef(null)
  const [sort, setSort] = React.useState('default')
  const data = state.data
  const config = data?.config
  const currency = state.currency.length > 0 ? state.currency : config?.currency ?? 'USD'
  const fxRate = config?.fxRate ?? 7.2
  const balance = data?.balance
  const catalog = data?.catalog
  const rows = React.useMemo(() => sortRows(state.rows, sort), [state.rows, sort])

  React.useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    const onPointer = (event) => {
      if (panelRef.current !== null && panelRef.current.contains(event.target)) return
      if (anchor?.element != null && anchor.element.contains(event.target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer, true)
    }
  }, [onClose, anchor])

  React.useEffect(() => {
    if (inputRef.current !== null) inputRef.current.focus()
  }, [])

  const rect = anchor?.rect
  const panelStyle = rect === undefined
    ? { left: '12px', bottom: '64px' }
    : {
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8))}px`,
      bottom: `${Math.max(8, window.innerHeight - rect.top + 8)}px`,
    }

  const balanceKnown = balance?.ok === true
  // An unavailable balance is not an error to shout: the headline stays short
  // and the reason moves to the small line below it.
  const balanceText = balanceKnown
    ? formatMoney(balance.total, balance.currency)
    : t('panel.balance.unknown')
  const balanceReason = balanceKnown
    ? ''
    : data?.sources?.balance?.kind === 'none'
      ? t('panel.balance.noApi')
      : balance?.message ?? t('panel.balance.unknown')

  const showSkeleton = data === null && state.phase === 'loading'

  return (
    <div ref={panelRef} className="ma-panel" style={panelStyle} role="dialog" aria-label={t('panel.title')}>
      <div className="ma-header">
        <span className="ma-title">{t('panel.title')}</span>
        <button type="button" className="ma-ghost" onClick={onRefresh} disabled={state.busy}>
          <IconRefreshOutline16 />
          {state.busy ? t('panel.refreshing') : t('panel.refresh')}
        </button>
        <button type="button" className="ma-icon-btn" onClick={onClose} aria-label={t('panel.close')}>
          <IconCloseOutline16 />
        </button>
      </div>

      <div className="ma-balance">
        <span className={balanceKnown ? 'ma-amount' : 'ma-amount is-unknown'}>{balanceText}</span>
        {balanceKnown && <span className="ma-source is-ok">{balance.source}</span>}
        {!balanceKnown && balanceReason.length > 0 && (
          <span className="ma-source is-muted">{balanceReason}</span>
        )}
      </div>
      <div className="ma-balance-meta">
        {balance?.ok === true && (
          <>
            <span>{t('panel.balance.granted')} {formatMoney(balance.granted, balance.currency)}</span>
            <span>{t('panel.balance.toppedUp')} {formatMoney(balance.toppedUp, balance.currency)}</span>
          </>
        )}
        <span>
          {fill(t('panel.balance.updated'), { time: formatWhen(balance?.fetchedAt, t('panel.balance.never')) })}
        </span>
      </div>

      <div className="ma-controls">
        <label className="ma-search">
          <span className="ma-search-icon"><IconSearchOutline16 /></span>
          <input
            ref={inputRef}
            value={state.query}
            placeholder={t('panel.search')}
            onChange={event => onSearch(event.target.value)}
          />
        </label>
        <div className="ma-chips">
          <span className="ma-chip-label">{t('panel.filter.domains')}</span>
          {(config?.domains ?? []).map(domain => (
            <button
              key={domain}
              type="button"
              className={state.domains.includes(domain) ? 'ma-chip is-active' : 'ma-chip'}
              aria-pressed={state.domains.includes(domain)}
              onClick={() => onDomain(domain)}
            >
              {domain}
            </button>
          ))}
          {(state.domains.length > 0 || state.modalities.length > 0) && (
            <button type="button" className="ma-chip ma-chip-clear" onClick={onClearFilters}>
              {t('panel.filter.clear')}
            </button>
          )}
        </div>
        <div className="ma-chips">
          <span className="ma-chip-label">{t('panel.filter.modalities')}</span>
          {(config?.modalities ?? []).map(label => (
            <button
              key={label}
              type="button"
              className={state.modalities.includes(label) ? 'ma-chip is-active' : 'ma-chip'}
              aria-pressed={state.modalities.includes(label)}
              onClick={() => onModality(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ma-chips">
          <span className="ma-chip-label">{t('panel.sort')}</span>
          {SORTS.map(([key]) => (
            <button
              key={key}
              type="button"
              className={sortActive(sort, key) ? 'ma-chip is-active' : 'ma-chip'}
              onClick={() => setSort(current => nextSort(current, key))}
            >
              {t(sortLabelKey(sort, key))}
            </button>
          ))}
        </div>
      </div>

      <div className="ma-list">
        <div className="ma-head">
          <span>{t('panel.col.model')}</span>
          <span>{t('panel.col.domains')}</span>
          <span>{t('panel.col.price')}</span>
        </div>
        {showSkeleton
          ? <Skeleton />
          : rows.length === 0
            ? (
              <div className="ma-empty">
                <IconSearchOutline16 />
                <span>{state.searching ? t('panel.refreshing') : t('panel.empty')}</span>
                <span className="ma-empty-hint">{t('panel.emptyHint')}</span>
              </div>
            )
            : (
              <>
                {rows.map(row => (
                  <ModelRow
                    key={row.key}
                    row={row}
                    currency={currency}
                    fxRate={fxRate}
                    t={t}
                  />
                ))}
                {rows.length >= SEARCH_LIMIT && (
                  <div className="ma-list-note">{fill(t('panel.more'), { count: SEARCH_LIMIT })}</div>
                )}
              </>
            )}
      </div>

      <div className="ma-footer">
        <div className="ma-footer-row">
          <div className="ma-seg" role="group" aria-label={t('panel.currency')}>
            {['USD', 'CNY'].map(unit => (
              <button
                key={unit}
                type="button"
                className={currency === unit ? 'ma-seg-item is-active' : 'ma-seg-item'}
                aria-pressed={currency === unit}
                onClick={() => onCurrency(unit)}
              >
                {unit}
              </button>
            ))}
          </div>
          {config !== undefined && (
            <span>{config.fxLive ? fill(t('panel.fx.live'), { rate: config.fxRate.toFixed(3) }) : fill(t('panel.fx.fixed'), { rate: config.fxRate.toFixed(3) })}</span>
          )}
          {catalog !== undefined && catalog.count > 0 && (
            <span>{fill(t('panel.catalog'), { count: catalog.count, time: formatWhen(catalog.fetchedAt, t('panel.balance.never')) })}</span>
          )}
          {catalog !== undefined && catalog.message.length > 0 && (
            <span className="ma-error">{fill(t('panel.catalog.error'), { message: catalog.message })}</span>
          )}
        </div>
        {data !== null && (
          <div className="ma-footer-row">
            <span className="ma-source-label">{t('panel.sources')}</span>
          <span>
            {t('panel.sources.balance')}
            {' '}
            {data.sources.balance.kind === 'none'
              ? <span className="ma-source-muted">{t('panel.sources.none')}</span>
              : data.sources.balance.url.length > 0
                ? <a className="ma-row-link" href={data.sources.balance.url} target="_blank" rel="noreferrer">{data.sources.balance.label}</a>
                : <span>{data.sources.balance.label}</span>}
          </span>
            <span>
              {t('panel.sources.catalog')}
              {' '}
              <a className="ma-row-link" href={data.sources.catalog.url} target="_blank" rel="noreferrer">{data.sources.catalog.label}</a>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
