/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Number -> pixel scales and "nice" axis ticks, shared by every chart (pure functions, unit tested).

/** A round number at or above v (1, 2, 2.5, 5 x 10^n). */
export function niceCeil(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((n) => n >= v - 1e-9);
}

/** linear([d0, d1], [r0, r1])(x) */
export function linear([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1;
  return (x) => r0 + ((x - d0) / span) * (r1 - r0);
}

/** n+1 evenly spaced ticks from 0 to max. */
export function ticks(max, n = 4) {
  return Array.from({ length: n + 1 }, (_, i) => (max / n) * i);
}

/** Short tick labels: 1200 -> 1.2k */
export function short(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  return `${+v.toFixed(a < 10 ? 1 : 0)}`;
}

/** Highest value across series (at least `floor`), rounded up to a nice number. */
export function niceMax(values, floor = 0) {
  return niceCeil(Math.max(floor, ...values.filter((v) => Number.isFinite(v))));
}
