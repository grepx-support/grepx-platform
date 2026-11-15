/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Locations: which one the user last worked at (remembered on this device) and a picker for them.
import { esc, raw } from "/assets/kit/index.js";

const KEY = "grepx.location";

export const isHolding = (l) => l.holding;
export const notHolding = (l) => !l.holding;
export const isKitchen = (l) => l.kind === "kitchen";

export function remembered(locations, filter = () => true) {
  const list = locations.filter(filter);
  let id = null;
  try { id = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  return (list.find((l) => l.id === id) || list[0] || {}).id || "";
}

export function remember(id) { try { localStorage.setItem(KEY, id); } catch (e) { /* storage unavailable */ } }

const KIND_ICON = { kitchen: "🍳", warehouse: "🏬", store: "🏪", showroom: "🏪", office: "🏢", truck: "🚚" };

/** <select> of locations (filtered), with the selected one chosen - safe markup (Raw). */
export function picker(locations, selected, filter = () => true, name = "location", label = "Location") {
  return raw(`<label class="pick">${esc(label)}<select name="${esc(name)}" data-pick>${locations.filter(filter).map((l) =>
    `<option value="${esc(l.id)}" ${l.id === selected ? "selected" : ""}>${KIND_ICON[l.kind] || "📍"} ${esc(l.name)}${l.holding ? " · holding" : ""}</option>`).join("")}</select></label>`);
}

export const placeName = (locations, id) => locations.find((l) => l.id === id)?.name || "";
