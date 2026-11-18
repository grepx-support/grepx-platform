/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// "Ask AI" about what the person picked - a few jobs, one driver, some invoices: the chat opens about exactly those,
// with questions that fit them (product.json ai.about.<kind>). Any page: askAbout("jobs", ids, "3 jobs").
import { html, icon } from "../../../kit/index.js";

export function askAbout(kind, ids, label = "", question = "") {
  const p = new URLSearchParams({ about: `${kind}:${[].concat(ids).join(",")}`, label: label || `${[].concat(ids).length} ${kind}` });
  if (question) p.set("ask", question);
  location.hash = `#/chat?${p}`;
}

/** The button: <button data-ask-ai="jobs" data-ids="a,b" data-label="2 jobs">; enableAskButtons() makes them work everywhere. */
export const askButton = (kind, ids, label, cls = "btn") => html`<button type="button" class="${cls}" data-ask-ai="${kind}" data-ids="${[].concat(ids).join(",")}"
  data-label="${label}">${icon("sparkle", { size: 15 })} Ask AI</button>`;

let on = false;
export function enableAskButtons() {
  if (on) return;
  on = true;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ask-ai]");
    if (!b) return;
    e.preventDefault();
    askAbout(b.dataset.askAi, b.dataset.ids.split(",").filter(Boolean), b.dataset.label);
  });
}
