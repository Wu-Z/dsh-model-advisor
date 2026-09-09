/**
 * Browser-side store behind the footer action and its panel.
 *
 * Holds one immutable state object (so React's `useSyncExternalStore` sees a
 * stable identity between changes), talks to the `modelAdvisor` Remote
 * namespace, and owns the panel's transient UI state.
 */

const SEARCH_DEBOUNCE_MS = 220

/** Unwrap a RemoteResult, returning the value or throwing the failure. */
function unwrap(result) {
  if (result !== null && typeof result === 'object' && result.ok === true) return result.value
  const code = result?.error?.code ?? 'gateway/internal'
  const message = result?.error?.message ?? 'remote call failed'
  throw new Error(`${code}: ${message}`)
}

/**
 * Create the advisor store for one client context.
 * @param ctx - client plugin context.
 * @returns the store consumed by the footer action component.
 */
export function createAdvisorStore(ctx) {
  let state = {
    phase: 'loading',
    error: '',
    open: false,
    busy: false,
    balanceBusy: false,
    data: null,
    rows: [],
    query: '',
    domains: [],
    modalities: [],
    searching: false,
    currency: '',
  }
  const listeners = new Set()
  let searchTimer = null
  let searchSequence = 0

  const publish = (patch) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const namespace = () => ctx.get('remote.modelAdvisor')

  const applySnapshot = (value, patch = {}) => {
    const currency = state.currency.length > 0 ? state.currency : value?.config?.currency ?? 'USD'
    publish({
      phase: 'ready',
      error: '',
      data: value,
      currency,
      rows: state.query.trim().length === 0 && state.domains.length === 0 && state.modalities.length === 0
        ? value.featured ?? []
        : state.rows,
      ...patch,
    })
  }

  const load = async (force) => {
    const remote = namespace()
    if (remote === undefined) {
      publish({ phase: 'error', error: 'modelAdvisor remote is not mounted' })
      return
    }
    publish({ busy: true })
    try {
      const stale = state.data === null
        || state.data.catalog?.count === 0
        || state.data.catalog?.stale === true
      const value = unwrap(await (force || stale ? remote.refresh() : remote.getSnapshot()))
      applySnapshot(value, { busy: false })
    } catch (error) {
      publish({ busy: false, phase: state.data === null ? 'error' : 'ready', error: String(error?.message ?? error) })
    }
  }

  const runSearch = async (query, domains, modalities) => {
    const remote = namespace()
    if (remote === undefined) return
    const sequence = ++searchSequence
    if (query.trim().length === 0 && domains.length === 0 && modalities.length === 0) {
      publish({ searching: false, rows: state.data?.featured ?? [] })
      return
    }
    publish({ searching: true })
    try {
      // The host searches the whole catalog, so a facet is never limited to the
      // page of featured rows already loaded.
      const rows = unwrap(await remote.search(query, domains, modalities)).rows
      if (sequence !== searchSequence) return
      publish({ searching: false, rows })
    } catch (error) {
      if (sequence !== searchSequence) return
      publish({ searching: false, error: String(error?.message ?? error) })
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot() {
      return state
    },
    /** Same snapshot for server rendering; the panel never hydrates from it. */
    getServerSnapshot() {
      return state
    },
    /** Load once, then keep the cached snapshot. */
    ensureLoaded() {
      if (state.data === null && !state.busy) void load(false)
    },
    refresh() {
      void load(true)
    },
    /** Re-read just the account balance, for the footer chip's own click. */
    refreshBalance() {
      const remote = namespace()
      if (remote === undefined) return
      publish({ balanceBusy: true })
      void (async () => {
        try {
          const value = unwrap(await remote.refreshBalance())
          applySnapshot(value, { balanceBusy: false })
        } catch (error) {
          publish({ balanceBusy: false, error: String(error?.message ?? error) })
        }
      })()
    },
    toggleOpen() {
      const open = !state.open
      publish({ open })
      if (open) void load(false)
    },
    close() {
      if (state.open) publish({ open: false })
    },
    setQuery(query) {
      publish({ query })
      if (searchTimer !== null) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        searchTimer = null
        void runSearch(query, state.domains, state.modalities)
      }, SEARCH_DEBOUNCE_MS)
    },
    /** Toggle one strength tag; several tags widen the result (OR). */
    toggleDomain(tag) {
      const domains = state.domains.includes(tag)
        ? state.domains.filter(value => value !== tag)
        : [...state.domains, tag]
      publish({ domains })
      void runSearch(state.query, domains, state.modalities)
    },
    /** Toggle one modality; several modalities widen the result (OR). */
    toggleModality(label) {
      const modalities = state.modalities.includes(label)
        ? state.modalities.filter(value => value !== label)
        : [...state.modalities, label]
      publish({ modalities })
      void runSearch(state.query, state.domains, modalities)
    },
    /** Drop every facet, keeping the search text. */
    clearFilters() {
      publish({ domains: [], modalities: [] })
      void runSearch(state.query, [], [])
    },
    setCurrency(currency) {
      publish({ currency })
      const remote = namespace()
      if (remote === undefined) return
      void (async () => {
        try {
          const value = unwrap(await remote.updateConfig({ currency }))
          applySnapshot(value, { currency })
        } catch {
          // A refused write keeps the local preference; the next read wins.
        }
      })()
    },
  }
}
