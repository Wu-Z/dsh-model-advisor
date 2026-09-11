/**
 * The fixed footer action, three parts:
 *   - the balance text refreshes the balance in place;
 *   - a peak / off-peak badge (DeepSeek routes only);
 *   - the chevron button opens the model advisor panel.
 */

import * as React from 'react'
import { IconChevronDownOutline14, IconChevronRightOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { createPortal } from 'react-dom'
import { currentTier, formatBeijingSwitch, formatDuration, formatMoney, nextTierSwitch } from './format.js'
import { Panel } from './Panel.jsx'
import { PeakIcon, ValleyIcon } from './tier-icons.jsx'

/** Interpolate `{name}` placeholders in a dictionary string. */
function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
}

/**
 * Re-render once a minute while the badge is visible, so the tier flips on the
 * boundary instead of waiting for the next balance poll.
 * @param active - whether the badge is on screen.
 * @returns the current epoch milliseconds.
 */
function useTierNow(active) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!active) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/**
 * Render the balance chip and, when open, its portalled panel.
 * @param props - the slot props plus the injected advisor store.
 */
export function Corner({ advisor, wide, t }) {
  const state = React.useSyncExternalStore(
    advisor.subscribe,
    advisor.getSnapshot,
    advisor.getServerSnapshot ?? advisor.getSnapshot,
  )
  const buttonRef = React.useRef(null)
  const [anchor, setAnchor] = React.useState(null)

  React.useEffect(() => { advisor.ensureLoaded() }, [advisor])
  React.useEffect(() => { if (!state.open) setAnchor(null) }, [state.open])

  const toggle = () => {
    if (state.open) {
      advisor.close()
      return
    }
    const element = buttonRef.current
    if (element !== null) setAnchor({ element, rect: element.getBoundingClientRect() })
    advisor.toggleOpen()
  }

  // Peak/off-peak pricing is DeepSeek-only, so the badge appears exactly when the
  // current model is routed through DeepSeek.
  const showsTier = state.data?.sources?.balance?.kind === 'deepseek'
  const now = useTierNow(showsTier)
  const tier = showsTier ? currentTier(now) : 'offPeak'
  const tierSwitch = showsTier ? nextTierSwitch(now) : null
  const tierTitle = tierSwitch === null
    ? ''
    : `${t(tier === 'peak' ? 'corner.peak' : 'corner.offPeak')} · ${fill(t('corner.tierUntil'), {
      time: formatBeijingSwitch(tierSwitch.atMs, now),
      left: formatDuration(tierSwitch.remainingMs),
    })} — ${t('corner.tierHint')}`

  const balance = state.data?.balance
  const ok = balance?.ok === true
  const label = ok
    ? `${t('corner.label')}：${formatMoney(balance.total, balance.currency)}`
    : state.balanceBusy
      ? t('corner.refreshing')
      : state.phase === 'loading' ? t('corner.loading') : t('corner.failed')

  const balanceClass = [
    'ma-balance-btn',
    wide ? '' : 'is-rail',
    ok ? '' : 'is-error',
    state.balanceBusy ? 'is-busy' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wide ? 'ma-corner' : 'ma-corner is-rail'}>
      <button
        type="button"
        className={balanceClass}
        onClick={() => advisor.refreshBalance()}
        title={t('corner.refresh')}
        aria-label={t('corner.refresh')}
      >
        <span className="ma-balance-text">
          {wide ? label : ok ? formatMoney(balance.total, balance.currency) : '—'}
        </span>
      </button>
      {showsTier && (
        <span
          className={tier === 'peak' ? 'ma-tier-badge is-peak' : 'ma-tier-badge is-valley'}
          title={tierTitle}
          aria-label={tierTitle}
        >
          {tier === 'peak' ? <PeakIcon /> : <ValleyIcon />}
          {wide && <span>{t(tier === 'peak' ? 'corner.peak' : 'corner.offPeak')}</span>}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={state.open ? 'ma-icon-btn is-open' : 'ma-icon-btn'}
        onClick={toggle}
        title={t('corner.open')}
        aria-label={t('corner.open')}
        aria-haspopup="dialog"
        aria-expanded={state.open}
      >
        {state.open ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
      </button>
      {state.open && createPortal(
        <Panel
          state={state}
          t={t}
          anchor={anchor}
          onRefresh={() => advisor.refresh()}
          onClose={() => advisor.close()}
          onSearch={value => advisor.setQuery(value)}
          onDomain={domain => advisor.toggleDomain(domain)}
          onModality={label => advisor.toggleModality(label)}
          onClearFilters={() => advisor.clearFilters()}
          onCurrency={currency => advisor.setCurrency(currency)}
        />,
        document.body,
      )}
    </div>
  )
}
