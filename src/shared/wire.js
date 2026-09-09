/**
 * Wire schemas shared by the host Typert manifest and the browser Remote
 * contribution. Both bundles embed their own copy of these zod v4 schemas;
 * keeping one source file is what stops the two faces from drifting.
 *
 * Every field is required and JSON-safe on purpose: the gateway rejects an
 * explicit `undefined` property, so absent values travel as `''`, `0`, or
 * `null` instead.
 */

import { z } from 'zod'

const num = z.number()

export const balanceSchema = z.object({
  ok: z.boolean(),
  currency: z.string(),
  total: num,
  granted: num,
  toppedUp: num,
  source: z.string(),
  message: z.string(),
  fetchedAt: num,
})

export const costSchema = z.object({
  input: num,
  output: num,
  cacheRead: num,
  cacheWrite: num,
})

export const priceTierSchema = z.object({
  key: z.string(),
  input: num,
  output: num,
  cacheRead: num,
  inputCny: num,
  outputCny: num,
  cacheReadCny: num,
})

export const modelRowSchema = z.object({
  key: z.string(),
  provider: z.string(),
  providerName: z.string(),
  id: z.string(),
  name: z.string(),
  family: z.string(),
  description: z.string(),
  summary: z.string(),
  domains: z.array(z.string()),
  reasoning: z.boolean(),
  toolCall: z.boolean(),
  vision: z.boolean(),
  inputModalities: z.array(z.string()),
  outputModalities: z.array(z.string()),
  openWeights: z.boolean(),
  context: num,
  maxOutput: num,
  cost: z.union([costSchema, z.null()]),
  doc: z.string(),
  consoleUrl: z.string(),
  releaseDate: z.string(),
  configured: z.boolean(),
  isDefault: z.boolean(),
  channelName: z.string(),
  priceFallback: z.boolean(),
  priceKind: z.string(),
  priceRef: z.union([priceRefSchema, z.null()]),
  tiers: z.union([z.array(priceTierSchema), z.null()]),
  source: z.string(),
})

export const priceRefSchema = z.object({
  input: num,
  output: num,
  cacheRead: num,
  providerName: z.string(),
})

export const catalogStateSchema = z.object({
  fetchedAt: num,
  count: num,
  stale: z.boolean(),
  message: z.string(),
})

export const customBalanceSchema = z.object({
  enabled: z.boolean(),
  url: z.string(),
  method: z.string(),
  headerName: z.string(),
  credentialRef: z.string(),
  path: z.string(),
  currency: z.string(),
})

export const configStateSchema = z.object({
  currency: z.string(),
  fxRate: num,
  fxLive: z.boolean(),
  fxFetchedAt: num,
  balanceRefreshMinutes: num,
  catalogTtlHours: num,
  customBalance: customBalanceSchema,
  domains: z.array(z.string()),
  modalities: z.array(z.string()),
})

export const snapshotSchema = z.object({
  config: configStateSchema,
  balance: balanceSchema,
  catalog: catalogStateSchema,
  configured: z.array(modelRowSchema),
  featured: z.array(modelRowSchema),
  sources: sourcesSchema,
  updatedAt: num,
})

export const sourcesSchema = z.object({
  balance: z.object({
    kind: z.string(),
    label: z.string(),
    url: z.string(),
    channel: z.string(),
  }),
  catalog: z.object({ label: z.string(), url: z.string() }),
})

export const searchResultSchema = z.object({ rows: z.array(modelRowSchema) })

export const configPatchSchema = z.object({
  currency: z.string().optional(),
  fxRate: num.optional(),
  balanceRefreshMinutes: num.optional(),
  catalogTtlHours: num.optional(),
  customBalance: customBalanceSchema.partial().optional(),
})

/** Build one strict codec descriptor. */
export function codec(typeSymbol, schema) {
  return { mode: 'strict', typeSymbol: `dsh-model-advisor#${typeSymbol}`, schema }
}
