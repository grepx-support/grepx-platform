/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Clock in / out (a shared tablet at the place): tap your name, type your PIN - in, or out when already in.
import { api, run } from "/assets/app.js";
import { html } from "/assets/kit/index.js";
import { biz } from "../lib/business.js";
import { picker, remember, remembered } from "../lib/place.js";
import { frame } from "./common.js";
import { cap, words } from "../lib/words.js";

export async function clockPage(el, q) {
  const b = await biz();
  const site = q.site || remembered(b.locations);
  const { people } = await api(`/roster/people?site_id=${site || ""}`);
  const body = frame(el, "clock", "Clock in / out", "Tap your name, then type your PIN.", picker(b.locations, site, () => true, "site", cap(words().place)));
  el.querySelector("[data-pick]").onchange = (e) => { remember(e.target.value); clockPage(el, { site: e.target.value }); };
  body.innerHTML = String(html`<div class="ck-names">${people.map((p) => html`<button class="ck-name" data-e="${p.employee_id}"><b>${p.name}</b><span>${p.position}</span></button>`)}</div>`);
  body.querySelectorAll("[data-e]").forEach((btn) => btn.onclick = () => pad(body, btn.dataset.e, btn.querySelector("b").textContent, site, () => clockPage(el, { site })));
}

function pad(body, employee_id, name, site, done) {
  let pin = "";
  const box = document.createElement("div");
  box.className = "card ck-pad";
  const draw = () => { box.innerHTML = `<h2>${name}</h2><div class="ck-dots">${"●".repeat(pin.length)}${"○".repeat(Math.max(0, 4 - pin.length))}</div>
    <div class="ck-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "×", 0, "OK"].map((k) => `<button data-k="${k}">${k}</button>`).join("")}</div>`; };
  draw();
  body.replaceChildren(box);
  box.onclick = async (e) => {
    const k = e.target.dataset.k;
    if (k === undefined) return;
    if (k === "×") { if (!pin) return done(); pin = pin.slice(0, -1); return draw(); }
    if (k !== "OK") { if (pin.length < 6) pin += k; return draw(); }
    const r = await run(() => api("/roster/clock", { method: "POST", body: { employee_id, pin, site_id: site } }));
    if (r) { box.innerHTML = `<h2>${r.clocked === "in" ? "Welcome" : "Goodbye"}, ${name}</h2><p class="ck-big">${r.clocked === "in" ? "Clocked in" : "Clocked out"} ${(r.attendance.clock_out || r.attendance.clock_in).slice(11)}</p>
      ${r.attendance.late_min ? `<p class="bad">${r.attendance.late_min} min late</p>` : ""}`; setTimeout(done, 2500); } else { pin = ""; draw(); }
  };
}
