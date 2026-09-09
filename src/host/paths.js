/** Resolve the DSH home and this plugin's own state paths. */

import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Resolve the DSH data root: an explicit `$DSH_HOME`, else `~/.dsh`.
 * Blank values are treated as unset, matching dsh-home-paths.
 * @returns absolute home directory.
 */
export function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim()
  return join(homedir(), '.dsh')
}

/** Directory holding this plugin's config and catalog cache. */
export function advisorDir() {
  return join(dshHome(), 'model-advisor')
}

/** Persisted plugin configuration. */
export function configPath() {
  return join(advisorDir(), 'config.json')
}

/** Persisted models.dev projection. */
export function catalogPath() {
  return join(advisorDir(), 'catalog.json')
}
