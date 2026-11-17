/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The morning brief, for every product: the day in a few lines - written by AI from the business's own numbers when AI
// is on, in the product's own words when it is not - with a box to ask anything (opens the assistant). The product
// serves GET /ai/brief (grepx_bff.routers.ai) and says who may see it.
import { api } from "../../../app.js";
import { html, icon } from "../../../kit/index.js";

document.addEventListener("submit", (e) => {
  const form = e.target.closest?.(".hm-ask");
  if (!form) return;
  e.preventDefault();
  if (form.q.value.trim()) window.grepxAssistant?.open(form.q.value.trim());
  form.q.value = "";
});

export function briefWidget({ allowed = () => true, example = "which items sold most this month?" } = {}) {
  return {
    id: "brief", title: "Your brief", icon: "sparkle", size: "l", area: "#7c3aed", allowed,
    load: () => api("/ai/brief"),
    render: (d) => html`<div class="hm-brief">
        <p class="hm-brief-tag">${icon("sparkle", { size: 14 })} ${d.ai ? "AI brief" : "Today at a glance"}${d.ai ? "" : html` <span class="muted small">· ${d.why}</span>`}</p>
        <ul>${d.text.split("\n").filter(Boolean).map((l) => html`<li>${l.replace(/^[-•*]\s*/, "")}</li>`)}</ul>
        <form class="hm-ask">${icon("sparkle", { size: 16 })}<input name="q" placeholder="Ask anything - e.g. ${example}" autocomplete="off"><button class="btn small primary">Ask</button></form></div>`,
  };
}
