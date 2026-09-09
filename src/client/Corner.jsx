/**
 * The fixed footer action, two independent targets:
 *   - the balance text refreshes the balance in place;
 *   - the chevron button opens the model advisor panel.
 */

import * as React from 'react'
import { IconChevronDownOutline14, IconChevronRightOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { createPortal } from 'react-dom'
import { formatMoney } from './format.js'
import { Panel } from './Panel.jsx'

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
