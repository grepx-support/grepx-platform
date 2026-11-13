/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Unit tests for the kit's pure parts (no browser needed): node --test web/kit/test/
import assert from "node:assert/strict";
import { test } from "node:test";
import { esc, html, raw } from "../core/dom.js";
import { Emitter } from "../core/emitter.js";
import { MemoryStore } from "../core/local-store.js";
import { DashboardLayout } from "../dashboard/layout.js";
import { WidgetRegistry } from "../dashboard/widget-registry.js";
import { linear, niceCeil, niceMax, short, ticks } from "../charts/scale.js";

test("html escapes values but keeps Raw markup and arrays", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  const name = "<script>";
  assert.equal(html`<b>${name}</b>`.text, "<b>&lt;script&gt;</b>");
  assert.equal(html`<i>${raw("<u>ok</u>")}</i>`.text, "<i><u>ok</u></i>");
  assert.equal(html`${["<", raw("<br>")]}${null}${false}${0}`.text, "&lt;<br>0");
});

test("emitter calls handlers until they are removed", () => {
  const e = new Emitter(), got = [];
  const off = e.on("x", (v) => got.push(v));
  e.emit("x", 1); off(); e.emit("x", 2);
  assert.deepEqual(got, [1]);
});

test("dashboard layout merges a saved layout with the widgets that exist now", () => {
  const widgets = [{ id: "a", size: "l" }, { id: "b" }, { id: "c", size: "m" }];
  const saved = { order: ["c", "gone", "a"], sizes: { a: "s", c: "huge" }, hidden: ["b", "gone"] };
  const l = new DashboardLayout(widgets, saved);
  assert.deepEqual(l.order, ["c", "a", "b"]);                // saved order first, new widgets after, removed ones dropped
  assert.deepEqual([l.size("a"), l.size("b"), l.size("c")], ["s", "s", "m"]);   // invalid saved size falls back
  assert.deepEqual(l.visible(), ["c", "a"]);
  l.show("b"); l.arrange(["b", "c"]); l.grow("c"); l.hide("a");
  assert.deepEqual(l.toJSON(), { order: ["b", "c", "a"], sizes: { a: "s", b: "s", c: "l" }, hidden: ["a"] });
  assert.deepEqual(new DashboardLayout(widgets, null).visible(), ["a", "b", "c"]);
});

test("widget registry checks definitions and filters by who may see them", () => {
  const r = new WidgetRegistry();
  r.register({ id: "x", title: "X", load: async () => 1, render: () => "" });
  r.register({ id: "y", title: "Y", load: async () => 1, render: () => "", allowed: (ctx) => ctx.boss });
  assert.deepEqual(r.allowed({ boss: false }).map((d) => d.id), ["x"]);
  assert.equal(r.get("x").size, "s");
  assert.throws(() => r.register({ id: "z", title: "Z" }), /needs load/);
});

test("chart scales and nice ticks", () => {
  assert.deepEqual([niceCeil(0), niceCeil(7), niceCeil(23), niceCeil(260)], [1, 10, 25, 500]);
  assert.equal(niceMax([3, null, 41, NaN], 1), 50);
  assert.equal(linear([0, 10], [100, 0])(5), 50);
  assert.deepEqual(ticks(40, 4), [0, 10, 20, 30, 40]);
  assert.deepEqual([short(950), short(1250), short(2500000), short(2.25)], ["950", "1.3k", "2.5M", "2.3"]);
});

test("memory store has the local store's interface", () => {
  const s = new MemoryStore();
  assert.equal(s.get("k", "d"), "d");
  s.set("k", { a: 1 }); assert.deepEqual(s.get("k"), { a: 1 });
  s.remove("k"); assert.equal(s.get("k"), null);
});

test("a basket keeps its defaults when a setting is passed as undefined (builder without extras)", async () => {
  const { Basket } = await import("../basket/basket.js");
  const b = new Basket({ lines: [{ item_id: "a", qty: 2, expiry: "2026-01-01" }, { item_id: "b", qty: 0 }], extras: undefined, step: undefined, label: undefined });
  assert.equal(b.props.step, 1);
  assert.equal(b.props.label, "Quantity");
  assert.deepEqual(b.lines(), [{ item_id: "a", qty: 2 }]);
  const lot = new Basket({ lines: [{ item_id: "a", qty: 2, expiry: "2026-01-01" }], extras: [{ name: "expiry", label: "Expiry", type: "date" }] });
  assert.deepEqual(lot.lines(), [{ item_id: "a", qty: 2, expiry: "2026-01-01" }]);
});

test("square crop: the picture always covers the square, zoom keeps the centre", async () => {
  const { SquareCrop } = await import("../profile/crop.js");
  const c = new SquareCrop(800, 400, 200);            // wide picture: height fills the square
  assert.equal(c.scale, 0.5);
  assert.deepEqual(c.source(), [200, 0, 400]);       // centred
  c.pan(1000, 0);                                    // dragged too far right: stops at the left edge
  assert.deepEqual(c.source(), [0, 0, 400]);
  c.centre(); c.setZoom(2);
  assert.deepEqual(c.source(), [300, 100, 200]);     // twice as close, same centre
  c.setZoom(10);
  assert.equal(c.zoom, 4);
});

test("finder ranking: whole words and starts first, scattered letters last, misses dropped", async () => {
  const { rank, score } = await import("../../shell/finder/score.js");
  assert.equal(score("", "anything"), 1);
  assert.equal(score("xyz", "Chicken"), 0);
  const titles = rank("chi", [{ title: "Guajillo chilli" }, { title: "Kitchen" }, { title: "Chicken thigh" }, { title: "Beef chuck" }]).map((r) => r.title);
  assert.deepEqual(titles, ["Chicken thigh", "Guajillo chilli"]);
  assert.deepEqual(rank("rcv", [{ title: "Receive stock" }, { title: "Orders" }]).map((r) => r.title), ["Receive stock"]);
});

test("avatar: initials, a stable colour per name, the photo when there is one", async () => {
  const { avatar, hue, initials } = await import("../profile/avatar.js");
  assert.equal(initials("Olivia Owner"), "OO");
  assert.equal(initials("kim@demo-taco.test"), "KD");
  assert.deepEqual(hue("Olivia Owner"), hue("Olivia Owner"));
  assert.match(String(avatar("Olivia", { photo: "abc" })), /src="\/api\/v1\/media\/abc"/);
  assert.match(String(avatar("Olivia")), /<b>O<\/b>/);
});
