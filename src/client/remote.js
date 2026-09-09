/**
 * Browser-side Remote contribution for the `modelAdvisor` namespace.
 *
 * Mirrors the host Typert manifest: the same invocation ids, parameter wires,
 * and result codecs. Mounting it is what lets `ctx.remote.modelAdvisor.*` be
 * called from this bundle.
 */

import { z } from 'zod'
import { codec, configPatchSchema, searchResultSchema, snapshotSchema } from '../shared/wire.js'

const stringCodec = codec('Query', z.string())
const domainListCodec = codec('DomainList', z.array(z.string()))
const modalityListCodec = codec('ModalityList', z.array(z.string()))
const patchCodec = codec('ConfigPatch', configPatchSchema)
const snapshotCodec = codec('Snapshot', snapshotSchema)
const searchCodec = codec('SearchResult', searchResultSchema)

export const REMOTE_CONTRIBUTION = {
  package: 'dsh-model-advisor',
  descriptors: [
    {
      id: 'dsh-model-advisor#modelAdvisor/getSnapshot',
      service: 'modelAdvisor',
      namespace: 'modelAdvisor',
      method: 'getSnapshot',
      invocation: { kind: 'direct' },
      parameters: [],
      result: snapshotCodec,
    },
    {
      id: 'dsh-model-advisor#modelAdvisor/refresh',
      service: 'modelAdvisor',
      namespace: 'modelAdvisor',
      method: 'refresh',
      invocation: { kind: 'direct' },
      parameters: [],
      result: snapshotCodec,
    },
    {
      id: 'dsh-model-advisor#modelAdvisor/refreshBalance',
      service: 'modelAdvisor',
      namespace: 'modelAdvisor',
      method: 'refreshBalance',
      invocation: { kind: 'direct' },
      parameters: [],
      result: snapshotCodec,
    },
    {
      id: 'dsh-model-advisor#modelAdvisor/search',
      service: 'modelAdvisor',
      namespace: 'modelAdvisor',
      method: 'search',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'query', wire: 'query', source: 'json', codec: stringCodec },
        { name: 'domains', wire: 'domains', source: 'json', codec: domainListCodec },
        { name: 'modalities', wire: 'modalities', source: 'json', codec: modalityListCodec },
      ],
      result: searchCodec,
    },
    {
      id: 'dsh-model-advisor#modelAdvisor/updateConfig',
      service: 'modelAdvisor',
      namespace: 'modelAdvisor',
      method: 'updateConfig',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'patch', wire: 'patch', source: 'json', codec: patchCodec }],
      result: snapshotCodec,
    },
  ],
}
