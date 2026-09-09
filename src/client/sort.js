/**
 * Client-side sorting for the model table. Kept out of the JSX module so it can
 * be unit-tested without a browser.
 */

/** USD output price used for sorting; `null` when the row has no price. */
export function priceValue(row) {
  if (Array.isArray(row.tiers) && row.tiers.length > 0) return row.tiers[0].output
  return row.cost === null ? null : row.cost.output
}

/**
 * Sort a copy of the rows. Unpriced rows always sink to the bottom, whichever
 * direction the price sort runs.
 * @param rows - rows to order.
 * @param sort - `default` | `priceAsc` | `priceDesc` | `release`.
 * @returns a new array; the input is never mutated.
 */
export function sortRows(rows, sort) {
  if (sort === 'default') return rows
  const list = [...rows]
  if (sort === 'priceAsc') {
    list.sort((left, right) => (priceValue(left) ?? Number.POSITIVE_INFINITY) - (priceValue(right) ?? Number.POSITIVE_INFINITY))
  } else if (sort === 'priceDesc') {
    list.sort((left, right) => (priceValue(right) ?? Number.NEGATIVE_INFINITY) - (priceValue(left) ?? Number.NEGATIVE_INFINITY))
  } else if (sort === 'release') {
    list.sort((left, right) => right.releaseDate.localeCompare(left.releaseDate))
  }
  return list
}
