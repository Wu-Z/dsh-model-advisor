/**
 * Hand-written Typert manifest for the model advisor host face.
 *
 * The manifest has the same shape the generator emits for first-party packages:
 * `./typert` exports `TYPERT`, and every codec is a zod v4 instance. It is
 * registered automatically by `dsh-typert-loader` when the Loader mounts this
 * package, which is what makes `ctx.remote.modelAdvisor.*` exist in the browser.
 *
 * @module dsh-model-advisor/typert
 */

import { z } from 'zod'
import {
  codec,
  configPatchSchema,
  searchResultSchema,
  snapshotSchema,
} from '../shared/wire.js'

const stringCodec = codec('Query', z.string())
const domainListCodec = codec('DomainList', z.array(z.string()))
const modalityListCodec = codec('ModalityList', z.array(z.string()))
const patchCodec = codec('ConfigPatch', configPatchSchema)
const snapshotCodec = codec('Snapshot', snapshotSchema)
const searchCodec = codec('SearchResult', searchResultSchema)

/** The host-face contribution registered into `ctx.typert`. */
export const TYPERT = {
  package: 'dsh-model-advisor',
  face: 'host',
  schemas: [],
  invocations: [
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
  model: {
    services: [
      {
        key: 'modelAdvisor',
        exportName: 'modelAdvisor',
        description: '模型顾问:账户余额、模型擅长领域、API 费用与配置链接。',
        summary: 'Balance, model capabilities, API pricing and configuration links for the web panel.',
        jsDoc: '/** Model advisor host service behind the `modelAdvisor` Remote namespace. */',
        tags: ['llm', 'billing', 'web'],
        members: [
          { name: 'getSnapshot', kind: 'method', signature: 'getSnapshot(): Promise<Snapshot>' },
          { name: 'refresh', kind: 'method', signature: 'refresh(): Promise<Snapshot>' },
          { name: 'refreshBalance', kind: 'method', signature: 'refreshBalance(): Promise<Snapshot>' },
          { name: 'search', kind: 'method', signature: 'search(query: string, domains: string[], modalities: string[]): Promise<SearchResult>' },
          { name: 'updateConfig', kind: 'method', signature: 'updateConfig(patch: ConfigPatch): Promise<Snapshot>' },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
