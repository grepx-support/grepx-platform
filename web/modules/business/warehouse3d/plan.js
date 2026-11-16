/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Where everything stands in the 3D warehouse, in metres - plain maths, no drawing (so it can be checked on its own).
// Each zone is a row of pallet racking with an aisle in front; each bin is one bay with three shelves. Stock shows as
// cartons: more stock = more cartons (square root, so a small bin still shows). Lots without a bin sit on pallets
// in a staging area in front of the racks.
export const BAY = { w: 2.4, d: 1.1, h: 3.3, levels: [0.14, 1.18, 2.22], gap: 0.14, aisle: 3.4 };
export const CARTON = { w: 0.66, d: 0.46, h: 0.6 };
const ACROSS = 3, DEEP = 2, PER_LEVEL = ACROSS * DEEP, PER_BAY = BAY.levels.length * PER_LEVEL;
const PALLET = { w: 1.3, d: 1.1, h: 0.15, gap: 0.5, layers: 3 };

const worst = (lots) => {
  const days = lots.map((l) => l.days_left).filter((d) => d !== null && d !== undefined);
  return days.length ? Math.min(...days) : null;
};
export const toneOf = (days) => (days === null ? "none" : days < 0 ? "bad" : days <= 2 ? "warn" : days <= 7 ? "info" : "good");
const SEVERE = ["bad", "warn", "info", "good", "none"];
// A lot may carry its own tone (a product colouring by something other than expiry, e.g. how long a phone has sat in stock).
const lotTone = (l) => l.tone || toneOf(l.days_left ?? null);
const toneOfLots = (ls) => (ls.some((l) => l.tone) ? ls.map(lotTone).sort((a, z) => SEVERE.indexOf(a) - SEVERE.indexOf(z))[0] : toneOf(worst(ls)));
const jitter = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };

export function cartonCount(qty, most, room = PER_BAY) {
  if (!(qty > 0)) return 0;
  return Math.max(1, Math.min(room, Math.round(room * Math.sqrt(qty / Math.max(most, qty)))));
}

/** Carton centres in a bay (x across, y up, z towards the aisle), bottom shelf first, front row first. */
export function rackSlots(n) {
  return Array.from({ length: n }, (_, i) => {
    const level = Math.floor(i / PER_LEVEL), w = i % PER_LEVEL, row = Math.floor(w / ACROSS), col = w % ACROSS;
    return { x: (col - 1) * (CARTON.w + 0.1) + jitter(i, 1) * 0.06, y: BAY.levels[level] + 0.05 + CARTON.h / 2,
      z: (row === 0 ? 0.25 : -0.25) + jitter(i, 2) * 0.04, turn: jitter(i, 3) * 0.12 };
  });
}

/** Carton centres on a floor pallet: 2 x 2 per layer, up to three layers. */
export function palletSlots(n) {
  return Array.from({ length: Math.min(n, 4 * PALLET.layers) }, (_, i) => {
    const layer = Math.floor(i / 4), w = i % 4;
    return { x: (w % 2 - 0.5) * (CARTON.w + 0.04), y: PALLET.h + layer * CARTON.h + CARTON.h / 2, z: (Math.floor(w / 2) - 0.5) * (CARTON.d + 0.04), turn: jitter(i, 4) * 0.08 };
  });
}

export function plan(bins, lots) {
  const byBin = new Map();
  lots.forEach((l) => { const k = l.bin_id || ""; byBin.set(k, [...(byBin.get(k) || []), l]); });
  const total = (ls) => ls.reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const racked = [...bins].sort((a, z) => (a.zone || "").localeCompare(z.zone || "") || a.code.localeCompare(z.code, undefined, { numeric: true }));
  const zoneNames = [...new Set(racked.map((b) => b.zone || "other"))];
  const loose = byBin.get("") || [];
  const most = Math.max(1, ...racked.map((b) => total(byBin.get(b.id) || [])));
  const pitch = BAY.d + BAY.aisle;
  const bays = [];
  const zones = zoneNames.map((name, r) => {
    const row = racked.filter((b) => (b.zone || "other") === name);
    row.forEach((b, c) => {
      const ls = byBin.get(b.id) || [], qty = total(ls);
      bays.push({ id: b.id, code: b.code, zone: name, lots: ls, qty, tone: toneOfLots(ls), floor: false,
        x: c * (BAY.w + BAY.gap), z: -r * pitch, cartons: rackSlots(cartonCount(qty, most)) });
    });
    return { name, z: -r * pitch, x0: -BAY.w / 2, x1: row.length * (BAY.w + BAY.gap) - BAY.gap - BAY.w / 2 };
  });
  // loose stock: one pallet per item, in a staging row in front of the first aisle
  const items = [...new Set(loose.map((l) => l.item_id || l.item_name))];
  const mostLoose = Math.max(1, ...items.map((it) => total(loose.filter((l) => (l.item_id || l.item_name) === it))));
  items.forEach((it, i) => {
    const ls = loose.filter((l) => (l.item_id || l.item_name) === it), qty = total(ls);
    bays.push({ id: `floor:${it}`, code: `Floor ${i + 1}`, zone: "staging", lots: ls, qty, tone: toneOfLots(ls), floor: true,
      x: i * (PALLET.w + PALLET.gap), z: BAY.aisle + 0.4, cartons: palletSlots(cartonCount(qty, mostLoose, 4 * PALLET.layers)) });
  });
  const xs = bays.map((b) => b.x), zs = bays.map((b) => b.z);
  const box = bays.length ? { x0: Math.min(...xs) - BAY.w, x1: Math.max(...xs) + BAY.w, z0: Math.min(...zs) - BAY.d, z1: Math.max(...zs) + BAY.aisle } : { x0: -5, x1: 5, z0: -5, z1: 5 };
  const centre = { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2 };
  bays.forEach((b) => { b.x -= centre.x; b.z -= centre.z; });
  zones.forEach((z) => { z.x0 -= centre.x; z.x1 -= centre.x; z.z -= centre.z; });
  const count = (t) => bays.filter((b) => b.lots.some((l) => lotTone(l) === t)).length;
  return { bays, zones, pitch, size: { w: box.x1 - box.x0, d: box.z1 - box.z0 }, staging: items.length ? BAY.aisle + 0.4 - centre.z : null,
    stats: { bins: bins.length, lots: lots.length, expired: count("bad"), soon: count("warn") } };
}

/** How full a bay is, 0..1 (cartons shown against what its shelves or pallet hold). */
export const fillOf = (bay) => bay.cartons.length / (bay.floor ? 4 * PALLET.layers : PER_BAY);

/**
 * The walk for a pick list: from the dock (front left, by the staging area) along the aisles to each bin that holds
 * something to pick - front row first, left to right, changing aisle round the end of the racks - and back to the dock.
 * Returns { stops: [{bay, take: [{name, qty, unit}]}], points: [{x, z}] } (points on the floor, in walking order).
 */
export function pickRoute(pick, p) {
  const byId = new Map(p.bays.map((b) => [b.id, b]));
  const take = new Map();
  for (const line of pick.lines || []) {
    for (const lot of line.lots || []) {
      const bay = byId.get(lot.bin_id) || p.bays.find((b) => b.floor && b.lots.some((l) => l.lot_id === lot.lot_id));
      if (!bay) continue;
      take.set(bay.id, [...(take.get(bay.id) || []), { name: line.name, qty: lot.qty, unit: line.unit }]);
    }
  }
  const rows = [...new Set([...take.keys()].map((id) => byId.get(id).z))].sort((a, z) => z - a);   // front row first
  const stops = rows.flatMap((z) => [...take.keys()].map((id) => byId.get(id)).filter((b) => b.z === z)
    .sort((a, b) => a.x - b.x).map((bay) => ({ bay, take: take.get(bay.id) })));
  const lane = (b) => (b.floor ? b.z - 1.2 : b.z + BAY.d / 2 + BAY.aisle / 2);
  const left = Math.min(...p.bays.map((b) => b.x), 0) - BAY.w;
  const dock = { x: left, z: (p.staging ?? Math.max(...p.bays.map((b) => b.z), 0)) + 1.6 };
  const points = [dock];
  const go = (x, z) => { const last = points[points.length - 1]; if (Math.hypot(last.x - x, last.z - z) > 0.05) points.push({ x, z }); };
  for (const { bay } of stops) {
    const last = points[points.length - 1];
    if (Math.abs(last.z - lane(bay)) > 0.05) { go(left, last.z); go(left, lane(bay)); }    // round the end of the racks
    go(bay.x, lane(bay));
  }
  if (stops.length) { go(left, points[points.length - 1].z); go(dock.x, dock.z); }
  return { stops, points };
}

/** The bin next to `id` for an arrow key: left / right along its row, up (further back) / down (nearer) to the closest in the next row. */
export function neighbour(p, id, key) {
  const here = p.bays.find((b) => b.id === id);
  if (!here) return p.bays[0]?.id ?? null;
  const rows = [...new Set(p.bays.map((b) => b.z))].sort((a, z) => z - a);       // front row first
  const row = (z) => p.bays.filter((b) => b.z === z).sort((a, b) => a.x - b.x);
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const r = row(here.z), i = r.indexOf(here) + (key === "ArrowLeft" ? -1 : 1);
    return (r[Math.max(0, Math.min(r.length - 1, i))] || here).id;
  }
  const j = rows.indexOf(here.z) + (key === "ArrowUp" ? 1 : -1);
  if (j < 0 || j >= rows.length) return here.id;
  return row(rows[j]).reduce((best, b) => (Math.abs(b.x - here.x) < Math.abs(best.x - here.x) ? b : best)).id;
}
