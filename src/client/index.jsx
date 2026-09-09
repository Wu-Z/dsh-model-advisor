/** Browser half: mount the Remote namespace and the sidebar footer action. */

import { Corner } from './Corner.jsx'
import { en, NS, zh } from './locales.js'
import { REMOTE_CONTRIBUTION } from './remote.js'
import { createAdvisorStore } from './store.js'
import { injectStyles } from './styles.js'

/** Services required before the footer seat can register. */
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the model advisor browser surfaces.
 * @param ctx - client plugin context.
 */
export async function apply(ctx) {
  injectStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'model-advisor: dictionaries')

  const remote = ctx.remote
  if (remote !== undefined && typeof remote.$mount === 'function') {
    const dispose = await remote.$mount(REMOTE_CONTRIBUTION)
    ctx.effect(() => () => { dispose() }, 'model-advisor: remote contribution')
  }

  const store = createAdvisorStore(ctx)
  ctx.effect(() => () => store.dispose(), 'model-advisor: store lifetime')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'model-advisor',
    order: 10,
    locale: NS,
    inject: () => ({ advisor: store }),
  }, Corner))
}
