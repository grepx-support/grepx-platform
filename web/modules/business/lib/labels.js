/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Barcode labels for every business product: stuck on boxes, shelves, lots and food containers. One label per thing
// (an IMEI, a lot, a batch) or per product (its barcode, as many copies as needed). Printed from the browser on A4
// label sheets or a thermal label printer (its own driver), so any printer the computer has works.
//   await printLabelsDialog(items)   items: [{ code, title, lines: [..], price, big }]   big: one bold line, e.g. "USE BY 18 Nov"
import { state } from "/assets/app.js";
import { code128Svg, h, openDialog } from "/assets/kit/index.js";
import { cash } from "./money.js";

export const LAYOUTS = {
  "a4-24": { name: "A4 sheet - 24 labels (70 x 37 mm, 3 x 8)", page: "A4", cols: 3, w: 70, h: 37, gapX: 0, gapY: 0, top: 4.5, left: 0 },
  "a4-40": { name: "A4 sheet - 40 labels (52.5 x 29.7 mm, 4 x 10)", page: "A4", cols: 4, w: 52.5, h: 29.7, gapX: 0, gapY: 0, top: 0, left: 0 },
  "thermal-50x25": { name: "Thermal printer - 50 x 25 mm", page: "50mm 25mm", cols: 1, w: 50, h: 25, roll: true },
  "thermal-38x25": { name: "Thermal printer - 38 x 25 mm", page: "38mm 25mm", cols: 1, w: 38, h: 25, roll: true },
};
const KEY = "labels.layout";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The label sheet as a whole HTML document (printed in a hidden frame). */
export function labelsDocument(items, { layout = "a4-24", price = true, details = true, shop = true } = {}) {
  const L = LAYOUTS[layout] || LAYOUTS["a4-24"];
  const small = L.h < 30;
  const shopName = shop ? (state.me?.business_name || state.me?.business?.name || "") : "";
  const one = (it) => {
    let bars = "";
    try { bars = code128Svg(it.code, { height: 40, showText: true, fontSize: 11 }); } catch (e) { bars = `<b>${esc(it.code)}</b>`; }
    return `<div class="lb"><div class="top">${shopName ? `<span class="shop">${esc(shopName)}</span>` : ""}${price && it.price != null ? `<b class="price">${esc(cash(it.price))}</b>` : ""}</div>
      <div class="title">${esc(it.title)}</div>${it.big ? `<div class="big">${esc(it.big)}</div>` : ""}${details && (it.lines || []).length ? `<div class="lines">${(it.lines || []).slice(0, small ? 1 : 2).map(esc).join(" · ")}</div>` : ""}
      <div class="bars">${bars}</div></div>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${L.page}; margin: 0 }
    * { box-sizing: border-box } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000 }
    .sheet { display: grid; grid-template-columns: repeat(${L.cols}, ${L.w}mm); grid-auto-rows: ${L.h}mm; padding: ${L.top || 0}mm 0 0 ${L.left || 0}mm }
    .lb { width: ${L.w}mm; height: ${L.h}mm; padding: ${small ? "1.2mm 1.6mm" : "2mm 2.6mm"}; display: flex; flex-direction: column; overflow: hidden; ${L.roll ? "page-break-after: always;" : ""} }
    .top { display: flex; justify-content: space-between; gap: 2mm; font-size: ${small ? 6 : 7}pt } .shop { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
    .price { font-size: ${small ? 8 : 10}pt; white-space: nowrap }
    .title { font-weight: 700; font-size: ${small ? 7 : 8.5}pt; line-height: 1.15; max-height: 2.3em; overflow: hidden }
    .big { font-weight: 800; font-size: ${small ? 7.5 : 9}pt; letter-spacing: .02em }
    .lines { font-size: ${small ? 5.5 : 6.5}pt; line-height: 1.2; max-height: 2.4em; overflow: hidden; color: #222 }
    .bars { flex: 1; min-height: 0; display: flex; align-items: flex-end } .bars svg { width: 100%; height: 100%; max-height: ${small ? 13 : 17}mm }
    @media screen { body { background: #ddd } .sheet { background: #fff; margin: 10px auto; width: max-content } .lb { outline: 1px dashed #bbb } }
  </style></head><body><div class="sheet">${items.map(one).join("")}</div></body></html>`;
}

/** Print through a hidden frame (no pop-up to allow), then remove it. */
export function printLabels(items, opts) {
  const frame = h("iframe", { title: "Labels", style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0" });
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(labelsDocument(items, opts)); doc.close();
  setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000); }, 300);
}

/** Ask for the layout and what to show, with a live preview of the first labels; then print. copies: ask how many of each. */
export async function printLabelsDialog(items, opts = {}) {
  const { copies = false } = opts;
  if (!items.length) return;
  let saved = "a4-24";
  try { saved = localStorage.getItem(KEY) || saved; } catch (e) { /* private window */ }
  const body = h("div", { class: "lb-dialog" });
  body.innerHTML = `<div class="row"><label class="grow">Labels<select name="layout">${Object.entries(LAYOUTS).map(([k, l]) => `<option value="${k}" ${k === saved ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
      ${copies ? '<label>Copies of each<input name="copies" type="number" min="1" max="500" value="1" class="k-num"></label>' : ""}</div>
    <div class="row"><label class="check"><input type="checkbox" name="price" ${opts.price === false ? "" : "checked"}> Price</label><label class="check"><input type="checkbox" name="details" checked> ${esc(opts.detailsLabel || "Details")}</label>
      <label class="check"><input type="checkbox" name="shop" checked> Shop name</label></div>
    <p class="muted small">${items.length} label${items.length > 1 ? "s" : ""}. In the print window choose your label printer (or the A4 sheet), set margins to none and scale to 100%.</p>
    <iframe title="Preview" class="lb-preview" style="width:100%;height:260px;border:1px solid var(--line, #ddd);border-radius:10px;background:#ddd"></iframe>`;
  const read = () => ({ layout: body.querySelector("[name=layout]").value, price: body.querySelector("[name=price]").checked,
    details: body.querySelector("[name=details]").checked, shop: body.querySelector("[name=shop]").checked,
    copies: Math.max(1, Math.min(500, Number(body.querySelector("[name=copies]")?.value || 1))) });
  const preview = () => { const f = body.querySelector("iframe"); f.srcdoc = labelsDocument(items.slice(0, 12), read()); };
  body.addEventListener("input", preview);
  body.addEventListener("change", preview);
  setTimeout(preview, 0);
  const go = await openDialog({ title: "Print barcode labels", body, wide: true, actions: [{ label: "Cancel", value: "" }, { label: "Print", value: "print", primary: true }] });
  if (go !== "print") return;
  const o = read();
  try { localStorage.setItem(KEY, o.layout); } catch (e) { /* private window */ }
  printLabels(copies ? items.flatMap((it) => Array(o.copies).fill(it)) : items, o);
}
