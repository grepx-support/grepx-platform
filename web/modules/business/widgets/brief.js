/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The morning brief, for every product: the day in a few lines - written by AI from the business's own numbers when AI
// is on, in the product's own words when it is not - with a box to ask anything (opens the assistant). The product
// serves GET /ai/brief (grepx_bff.routers.ai) and says who may see it.
import { api } from "../../../app.js";
import { waitForJob } from "../lib/ai.js";
import { html, icon } from "../../../kit/index.js";

document.addEventListener("submit", (e) => {
  const form = e.target.closest?.(".hm-ask");
  if (!form) return;
  e.preventDefault();
  if (form.q.value.trim()) location.hash = `#/chat?ask=${encodeURIComponent(form.q.value.trim())}`;     // to the AI chat
  form.q.value = "";
});

const lines = (text) => String(text || "").split("\n").map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);

export function briefWidget({ allowed = () => true, example = "which items sold most this month?" } = {}) {
  return {
    id: "brief", title: "Your brief", icon: "sparkle", size: "l", area: "#7c3aed", allowed,
    load: async () => {
      const d = await api("/ai/brief");
      if (d.job_id) waitForJob(d.job_id).then((j) => {     // the AI brief replaces the plain one when it is ready
        const box = document.querySelector(`[data-brief="${d.job_id}"]`);
        if (!box || j.state !== "done" || !j.answer) { box?.querySelector(".hm-brief-wait")?.remove(); return; }
        box.querySelector("ul").innerHTML = String(html`${lines(j.answer).map((l) => html`<li>${l}</li>`)}`);
        box.querySelector(".hm-brief-tag").innerHTML = String(html`${icon("sparkle", { size: 14 })} AI brief`);
      });
      return d;
    },
    render: (d) => html`<div class="hm-brief" data-brief="${d.job_id || ""}">
        <p class="hm-brief-tag">${icon("sparkle", { size: 14 })} ${d.ai ? "AI brief" : "Today at a glance"}${d.job_id ? html` <span class="hm-brief-wait">· AI is writing today's brief…</span>`
          : d.ai || !d.why ? "" : html` <span class="muted small">· ${d.why}</span>`}</p>
        <ul>${lines(d.text).map((l) => html`<li>${l}</li>`)}</ul>
        <form class="hm-ask">${icon("sparkle", { size: 16 })}<input name="q" placeholder="Ask anything - e.g. ${example}" autocomplete="off"><button class="btn small primary">Ask</button></form></div>`,
  };
}
