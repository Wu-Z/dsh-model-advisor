/**
 * Two hand-drawn 16px glyphs for the DeepSeek peak / off-peak badge.
 *
 * The harness icon set ships no sun or moon, and a status badge wants to read
 * as friendly rather than technical — so these use round caps, generous curves
 * and a single solid core, matching the set's 16px grid and `currentColor`.
 */

import * as React from 'react'

/** Peak hours: a small sun with eight soft rays. */
export function PeakIcon({ size = 14 }) {
  const rays = [
    [12.4, 8, 14, 8], [11.11, 11.11, 12.24, 12.24],
    [8, 12.4, 8, 14], [4.89, 11.11, 3.76, 12.24],
    [3.6, 8, 2, 8], [4.89, 4.89, 3.76, 3.76],
    [8, 3.6, 8, 2], [11.11, 4.89, 12.24, 3.76],
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        {rays.map(([x1, y1, x2, y2], index) => (
          <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  )
}

/** Off-peak: a crescent moon with one tiny four-point star. */
export function ValleyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.4 12.6A5.6 5.6 0 0 1 6.1 3.2a5.9 5.9 0 1 0 4.3 9.4Z"
        fill="currentColor"
      />
      <path
        d="M12.5 2.2l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25L10.7 4l1.25-.55z"
        fill="currentColor"
      />
    </svg>
  )
}
