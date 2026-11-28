/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// WCAG 2 contrast for the kit's tokens: read the palettes' CSS, resolve each palette x mode to plain colours (hex,
// var(--x), color-mix(in srgb, A n%, B)), and check the pairs that carry text and status. Pure - the kit's tests run it
// on every palette, a product's tests on its own primary colour.

/** "#0e7490" / "#fff" -> [r, g, b] 0-255; null for anything else. */
export function rgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance. */
export function luminance(c) {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two hex colours, 1..21. */
export function ratio(a, b) {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The declarations of every CSS block: [{selector, vars: {name: value}}]. Comments stripped. */
export function blocks(css) {
  const out = [], text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const vars = {};
    for (const d of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)) vars[d[1]] = d[2].trim();
    out.push({ selector: m[1].trim(), vars });
  }
  return out;
}

/** A token value -> hex, following var() and color-mix(in srgb, ...) through the given vars. */
export function resolve(value, vars, depth = 0) {
  const v = String(value ?? "").trim();
  if (depth > 12) return null;
  if (rgb(v)) return hex(rgb(v));
  const ref = /^var\(--([\w-]+)\)$/.exec(v);
  if (ref) return resolve(vars[ref[1]], vars, depth + 1);
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)(?:\s+(\d+(?:\.\d+)?)%)?\)$/.exec(v);
  if (mix) {
    const a = rgb(resolve(mix[1], vars, depth + 1) || ""), b = rgb(resolve(mix[3], vars, depth + 1) || "");
    if (!a || !b) return null;
    const p = Number(mix[2]) / 100;
    return hex(a.map((x, i) => x * p + b[i] * (1 - p)));
  }
  return null;
}

/** What text and status must reach: 4.5 for text (WCAG AA), 3 for large text and UI parts (1.4.11). */
export const PAIRS = [
  ["ink", "bg", 4.5], ["ink", "card", 4.5], ["ink-2", "card", 4.5], ["muted", "card", 4.5], ["muted", "bg", 4.5],
  ["primary-ink", "primary", 4.5], ["link", "card", 4.5], ["link", "bg", 4.5],
  ["good", "card", 4.5], ["bad", "card", 4.5], ["warn", "card", 4.5], ["info", "card", 4.5],
  ["focus", "card", 3],
];
// Not checked: a filled primary button's edge against the card - the button is known by its label (primary-ink on
// primary, 4.5:1), so WCAG 1.4.11 does not ask its fill to stand out by 3:1.

/** The pairs of one resolved token set that fall short: [{fg, bg, need, got}]. */
export function shortfalls(vars) {
  const out = [];
  for (const [fg, bg, need] of PAIRS) {
    const a = resolve(`var(--${fg})`, vars), b = resolve(`var(--${bg})`, vars);
    if (!a || !b) { out.push({ fg, bg, need, got: null }); continue; }
    const got = ratio(a, b);
    if (got < need) out.push({ fg, bg, need, got: Math.round(got * 100) / 100, colours: [a, b] });
  }
  return out;
}
