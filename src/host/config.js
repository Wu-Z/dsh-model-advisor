/** Persisted configuration for the model advisor plugin. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DOMAIN_TAGS } from './domains.js'
import { advisorDir, configPath } from './paths.js'

export { DOMAIN_TAGS }

/** Built-in USD→CNY fallback used when the live rate cannot be fetched. */
export const DEFAULT_FX_RATE = 7.2

/** Shipped defaults, deep-merged under any stored document. */
export const DEFAULT_CONFIG = {
  currency: 'USD',
  fxRate: DEFAULT_FX_RATE,
  balanceRefreshMinutes: 5,
  catalogTtlHours: 6,
  customBalance: {
    enabled: false,
    url: '',
    method: 'GET',
    headerName: 'Authorization',
    credentialRef: '',
    path: '',
    currency: 'USD',
  },
}

const CURRENCIES = new Set(['USD', 'CNY'])
const METHODS = new Set(['GET', 'POST'])

/** Clamp a number into a range, falling back when it is not finite. */
function numberOr(value, fallback, min, max) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/** Keep a string field, trimmed, capped in length. */
function text(value, fallback = '', max = 400) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

/**
 * Normalize an arbitrary stored or patched document into the effective config.
 * @param raw - candidate document.
 * @returns a complete, validated config.
 */
export function normalizeConfig(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const custom = source.customBalance !== null && typeof source.customBalance === 'object'
    ? source.customBalance
    : {}
  const currency = CURRENCIES.has(source.currency) ? source.currency : DEFAULT_CONFIG.currency
  const method = METHODS.has(custom.method) ? custom.method : DEFAULT_CONFIG.customBalance.method
  const customCurrency = text(custom.currency, DEFAULT_CONFIG.customBalance.currency, 8).toUpperCase()
  return {
    currency,
    fxRate: numberOr(source.fxRate, DEFAULT_FX_RATE, 0.01, 1000),
    balanceRefreshMinutes: numberOr(
      source.balanceRefreshMinutes,
      DEFAULT_CONFIG.balanceRefreshMinutes,
      1,
      24 * 60,
    ),
    catalogTtlHours: numberOr(source.catalogTtlHours, DEFAULT_CONFIG.catalogTtlHours, 1, 24 * 30),
    customBalance: {
      enabled: custom.enabled === true,
      url: text(custom.url),
      method,
      headerName: text(custom.headerName, DEFAULT_CONFIG.customBalance.headerName, 80),
      credentialRef: text(custom.credentialRef, '', 120),
      path: text(custom.path, '', 200),
      currency: customCurrency.length === 0 ? DEFAULT_CONFIG.customBalance.currency : customCurrency,
    },
  }
}

/**
 * Read the stored document, tolerating a missing or corrupt file.
 * @returns the stored raw document (never throws).
 */
export async function readStoredConfig() {
  try {
    const raw = await readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Persist the effective config document.
 * @param config - complete config to store.
 */
export async function writeStoredConfig(config) {
  const path = configPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

/** The directory holding this plugin's files, for diagnostics. */
export const STATE_DIR = advisorDir
