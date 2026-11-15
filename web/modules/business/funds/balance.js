/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The capital position as a balance sheet (assets = liabilities + equity, it always balances), per currency, as of a
// date; open any line to see what is behind it (per fund, per use, per lender, per partner).
import { html, icon, pill } from "/assets/kit/index.js";
import { cash } from "./common.js";

const row = (l, cur) => html`<details class="bs-row-d"><summary class="bs-row"><span>${l.label}</span><span class="${l.amount < 0 ? "bad" : ""}">${cash(l.amount, cur)}</span></summary>
  ${l.rows.map((r) => html`<div class="bs-row bs-sub"><span>${r.label}</span><span>${cash(r.amount, cur)}</span></div>`)}</details>`;

const side = (title, lines, total, cur) => html`<div class="bs-side"><h3>${title}</h3>${lines.filter((l) => l.amount).map((l) => row(l, cur))}
  <div class="bs-row bs-total"><span>Total</span><span>${cash(total, cur)}</span></div></div>`;

export const balanceSheet = (sheets) => html`${Object.entries(sheets).map(([cur, b]) => html`<section class="card bs"><h2>${icon("chart")} Balance sheet of the funds (${cur})${b.as_of ? ` as of ${b.as_of}` : ""}
  ${b.balances ? pill("balances", "good") : pill("does not balance", "bad")}</h2><div class="bs-grid">${side("Assets", b.assets, b.assets_total, cur)}
  <div class="bs-side">${side("Liabilities", b.liabilities, b.liabilities_total, cur)}${side("Equity", b.equity, b.equity_total, cur)}</div></div></section>`)}`;
