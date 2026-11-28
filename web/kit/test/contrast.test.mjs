/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Every palette in both modes reaches WCAG AA on the pairs that carry text and status (4.5:1) and on the focus ring
// (3:1); the default palette does with any reasonable product colour; a product can be dark-first. node --test web/kit/test/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MemoryStore } from "../core/local-store.js";
import { blocks, ratio, resolve, shortfalls } from "../theme/contrast.js";
import { PALETTES } from "../theme/palettes.js";
import { Theme } from "../theme/theme.js";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const tokens = blocks(read("tokens.css")), palettes = blocks(read("palettes.css"));
const LIGHT = tokens[0].vars, DARK = { ...LIGHT, ...tokens[1].vars };

/** "id/light" | "id/dark" -> the resolved token set, as the browser cascades it on <html>. */
export function sets(product = {}) {
  const out = { "brand/light": { ...LIGHT, ...product }, "brand/dark": { ...DARK, ...product } };
  for (const b of palettes) {
    const id = /data-palette="(\w+)"/.exec(b.selector)?.[1];
    if (!id || !/\{|:/.test(b.selector + ":")) continue;
    const dark = /\[data-theme="dark"\]/.test(b.selector) && !/:not\(/.test(b.selector);
    if (!/^\[data-palette="\w+"\](:not\(\[data-theme="dark"\]\)|\[data-theme="dark"\])$/.test(b.selector)) continue;
    out[`${id}/${dark ? "dark" : "light"}`] = { ...(dark ? DARK : LIGHT), ...b.vars };
  }
  return out;
}

test("contrast maths: WCAG ratios, var() and color-mix are followed", () => {
  assert.equal(Math.round(ratio("#000", "#fff")), 21);
  assert.equal(ratio("#777", "#777"), 1);
  assert.equal(resolve("var(--a)", { a: "var(--b)", b: "#ff0000" }), "#ff0000");
  assert.equal(resolve("color-mix(in srgb, #000000 50%, #ffffff)", {}), "#808080");
  assert.equal(resolve("var(--missing)", {}), null);
});

test("every palette, light and dark, is readable", () => {
  const all = sets();
  for (const p of PALETTES) for (const mode of ["light", "dark"]) assert.ok(all[`${p.id}/${mode}`], `${p.id}/${mode} has no block`);
  const bad = Object.entries(all).map(([k, v]) => [k, shortfalls(v)]).filter(([, s]) => s.length);
  assert.deepEqual(bad, [], JSON.stringify(bad, null, 1));
});

test("the default palette stays readable with any product colour (links and focus are lightened in dark)", () => {
  for (const primary of ["#6d28d9", "#0e7490", "#be123c", "#1e40af", "#15803d", "#b45309", "#18181b", "#4f46e5"]) {
    for (const [k, v] of Object.entries(sets({ primary, "primary-ink": "#ffffff" })).filter(([k]) => k.startsWith("brand/"))) {
      assert.deepEqual(shortfalls(v), [], `${primary} ${k}`);
    }
  }
});

test("a dark-first product opens dark until the viewer picks; the default is remembered for the first paint", () => {
  const store = new MemoryStore(), dark = { matches: false, addEventListener() {} };
  const t = new Theme(store, dark, { dataset: {}, style: { setProperty() {}, removeProperty() {} } });
  assert.equal(t.current(), "light");                                   // system, and the device is light
  t.configure({ mode: "dark" });
  assert.equal(t.choice(), "dark");
  assert.equal(t.current(), "dark");
  assert.equal(store.get("theme_default"), "dark");
  t.set("light");
  assert.equal(t.current(), "light");                                   // the viewer's own pick wins
  t.configure({ mode: "nonsense" });
  assert.equal(store.get("theme_default"), "system");
});
