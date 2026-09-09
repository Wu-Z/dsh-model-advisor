/**
 * One injected stylesheet for the whole plugin.
 *
 * Inline styles cannot express hover, active, focus-visible, transitions or
 * scrollbar styling, so every surface is class-based and the sheet is appended
 * once. Colors come from the harness theme tokens only, so light and dark mode
 * are both covered without a second rule set.
 */

/** Stable identifier used for the injection guard and HMR bookkeeping. */
export const CSS_ID = 'dsh-model-advisor/client.css'

export const CSS = `
.ma-panel {
  position: fixed;
  z-index: 60;
  width: 560px;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #111);
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .12));
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, .22), 0 2px 8px rgba(0, 0, 0, .08);
  font: 400 12px/18px var(--dsw-font-family, ui-sans-serif, system-ui, -apple-system, sans-serif);
  animation: ma-enter 140ms cubic-bezier(.2, .8, .2, 1);
}
@keyframes ma-enter { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .ma-panel { animation: none } }

.ma-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
}
.ma-title { flex: 1 1 auto; font-size: 13px; font-weight: 600; letter-spacing: -.01em; }

.ma-ghost {
  appearance: none; display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid transparent; background: transparent; border-radius: 7px;
  padding: 3px 8px; font: inherit; font-size: 12px; line-height: 18px;
  color: var(--dsw-alias-label-secondary, #666); cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.ma-ghost:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .05)); color: var(--dsw-alias-label-primary, #111) }
.ma-ghost:active { background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, .08)) }
.ma-ghost:disabled { opacity: .55; cursor: default }
.ma-ghost:focus-visible, .ma-icon-btn:focus-visible, .ma-chip:focus-visible,
.ma-balance-btn:focus-visible, .ma-row-link:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #2563eb); outline-offset: 1px;
}

.ma-icon-btn {
  appearance: none; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  border: 1px solid transparent; border-radius: 7px; background: transparent;
  color: var(--dsw-alias-label-secondary, #666); cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.ma-icon-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .05)); color: var(--dsw-alias-label-primary, #111) }
.ma-icon-btn:active { background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, .08)) }
.ma-icon-btn.is-open {
  background: var(--dsw-alias-brand-primary, #2563eb);
  border-color: var(--dsw-alias-brand-primary, #2563eb);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}

.ma-balance { display: flex; align-items: baseline; gap: 8px; padding: 12px 12px 4px }
.ma-amount { font-size: 22px; font-weight: 600; letter-spacing: -.02em; font-variant-numeric: tabular-nums }
.ma-amount.is-unknown { font-size: 15px; font-weight: 500; color: var(--dsw-alias-label-secondary, #666) }
.ma-source { font-size: 11px }
.ma-source.is-ok { color: var(--dsw-alias-state-success-primary, #1a7f37) }
.ma-source.is-error { color: var(--dsw-alias-state-error-primary, #c0392b) }
.ma-source.is-muted { color: var(--dsw-alias-label-tertiary, #888) }
.ma-balance-meta {
  padding: 0 12px 12px; display: flex; gap: 12px; flex-wrap: wrap;
  color: var(--dsw-alias-label-tertiary, #888); font-size: 11px;
}

.ma-controls { padding: 0 12px 8px; display: flex; flex-direction: column; gap: 8px }
.ma-search { position: relative; display: block }
.ma-search input {
  width: 100%; box-sizing: border-box;
  padding: 7px 10px 7px 30px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .15)); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, .03));
  color: inherit; font: inherit; outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.ma-search input::placeholder { color: var(--dsw-alias-label-tertiary, #888) }
.ma-search input:focus-visible {
  border-color: var(--dsw-alias-brand-primary, #2563eb);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #2563eb) 18%, transparent);
}
.ma-search-icon {
  position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
  color: var(--dsw-alias-label-tertiary, #888); pointer-events: none; display: flex;
}

.ma-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center }
.ma-chip-label { color: var(--dsw-alias-label-tertiary, #888); font-size: 11px }
.ma-chip {
  appearance: none; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .15));
  background: transparent; border-radius: 999px; padding: 2px 10px;
  font: inherit; font-size: 11px; line-height: 18px;
  color: var(--dsw-alias-label-secondary, #666);
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.ma-chip:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .05)); color: var(--dsw-alias-label-primary, #111) }
.ma-chip-clear { border-style: dashed; color: var(--dsw-alias-label-tertiary, #888) }
.ma-chip.is-active {
  background: var(--dsw-alias-brand-primary, #2563eb);
  border-color: var(--dsw-alias-brand-primary, #2563eb);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}

.ma-list {
  flex: 1 1 auto; overflow-y: auto; padding: 0 6px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(0, 0, 0, .18)) transparent;
}
.ma-list::-webkit-scrollbar { width: 8px }
.ma-list::-webkit-scrollbar-thumb { background: var(--dsw-alias-scrollbar-bg-l2, rgba(0, 0, 0, .18)); border-radius: 4px }
.ma-list::-webkit-scrollbar-thumb:hover { background: var(--dsw-alias-scrollbar-hover-l2, rgba(0, 0, 0, .3)) }

.ma-head, .ma-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px 148px;
  column-gap: 12px;
}
.ma-head {
  position: sticky; top: 0; z-index: 1;
  padding: 8px 8px 6px;
  background: var(--dsw-alias-bg-layer-1, #fff);
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
  color: var(--dsw-alias-label-tertiary, #888);
  font-size: 11px; font-weight: 500;
}
.ma-head span:last-child { text-align: right }

.ma-row {
  row-gap: 2px; align-items: start;
  padding: 8px; border-radius: 8px;
  transition: background 120ms ease;
}
.ma-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .04)) }
.ma-row-name { grid-column: 1; grid-row: 1; min-width: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 600 }
.ma-row-tags { grid-column: 2; grid-row: 1; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start }
.ma-row-price { grid-column: 3; grid-row: 1 / span 2; text-align: right; display: flex; flex-direction: column; gap: 3px }
.ma-row-meta {
  grid-column: 1 / span 2; grid-row: 2; min-width: 0;
  color: var(--dsw-alias-label-tertiary, #888);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.ma-badge {
  font-size: 10px; line-height: 16px; padding: 0 5px; border-radius: 4px; font-weight: 400;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, .06));
  color: var(--dsw-alias-label-tertiary, #888);
}
.ma-badge.is-current {
  background: var(--dsw-alias-brand-primary, #2563eb);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.ma-tag {
  font-size: 10px; line-height: 16px; padding: 0 6px; border-radius: 4px; white-space: nowrap;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, .06));
  color: var(--dsw-alias-label-secondary, #666);
}

.ma-price { font-variant-numeric: tabular-nums; white-space: nowrap }
.ma-price-note { font-size: 10px; line-height: 14px; color: var(--dsw-alias-label-tertiary, #888) }
.ma-tier { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary, #888) }
.ma-tier.is-active { color: var(--dsw-alias-label-primary, #111); font-weight: 600 }
.ma-row-link {
  color: var(--dsw-alias-link, #2563eb); text-decoration: none; white-space: nowrap; font-size: 11px;
}
.ma-row-link:hover { text-decoration: underline }

.ma-skeleton-row {
  display: grid; grid-template-columns: minmax(0, 1fr) 150px 148px;
  column-gap: 12px; padding: 8px;
}
.ma-skeleton-bar {
  height: 10px; border-radius: 4px;
  background: var(--dsw-alias-bg-layer-3, rgba(0, 0, 0, .06));
  animation: ma-shimmer 1.4s ease-in-out infinite;
}
@keyframes ma-shimmer { 0%, 100% { opacity: .45 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .ma-skeleton-bar { animation: none } }

.ma-list-note {
  padding: 8px 8px 2px; text-align: center;
  color: var(--dsw-alias-label-tertiary, #888); font-size: 11px;
}
.ma-empty {
  padding: 32px 16px; text-align: center; color: var(--dsw-alias-label-tertiary, #888);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.ma-empty-hint { font-size: 11px; color: var(--dsw-alias-label-tertiary, #888); opacity: .8 }

.ma-footer {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
  padding: 8px 12px; display: flex; flex-direction: column; gap: 4px;
  color: var(--dsw-alias-label-tertiary, #888); font-size: 11px;
}
.ma-footer-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap }
.ma-seg {
  display: inline-flex; padding: 2px; gap: 2px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .12)); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, .03));
}
.ma-seg-item {
  appearance: none; border: none; background: transparent; border-radius: 6px;
  padding: 1px 9px; font: inherit; font-size: 11px; line-height: 18px;
  color: var(--dsw-alias-label-secondary, #666); cursor: pointer;
  transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
.ma-seg-item:hover { color: var(--dsw-alias-label-primary, #111) }
.ma-seg-item.is-active {
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #111);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .1);
}
.ma-seg-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #2563eb); outline-offset: 1px }
.ma-source-label { color: var(--dsw-alias-label-secondary, #666) }
.ma-source-muted { opacity: .8 }
.ma-footer .ma-error { color: var(--dsw-alias-state-error-primary, #c0392b) }

.ma-corner { display: flex; align-items: center; gap: 2px; width: 100% }
.ma-corner.is-rail { flex-direction: column; gap: 2px }
.ma-balance-btn {
  appearance: none; flex: 0 1 auto; min-width: 0; max-width: 100%;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 6px 6px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-secondary, #666);
  font: inherit; font-size: 12px; line-height: 20px; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.ma-balance-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .05)); color: var(--dsw-alias-label-primary, #111) }
.ma-balance-btn:active { background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, .08)) }
.ma-balance-btn.is-rail { flex: 0 0 auto; justify-content: center; padding: 4px 0; font-size: 11px }
.ma-balance-btn.is-error { color: var(--dsw-alias-state-error-primary, #c0392b) }
.ma-balance-text { overflow: hidden; text-overflow: ellipsis }
.ma-balance-btn.is-busy .ma-balance-text { animation: ma-pulse 1s ease-in-out infinite }
@keyframes ma-pulse { 0%, 100% { opacity: .5 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .ma-balance-btn.is-busy .ma-balance-text { animation: none } }
`

/** Append the stylesheet once; the loader claims it for HMR bookkeeping. */
export function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`) !== null) return
  const element = document.createElement('style')
  element.dataset.plugin = 'dsh-model-advisor'
  element.dataset.pluginCss = CSS_ID
  element.textContent = CSS
  document.head.appendChild(element)
}
