/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// My work - the staff member's phone screen: clock in / out with a PIN pad, my next shifts as date tiles, the hours I
// worked, my payslips (tap for the PDF), my leave balance and asking for leave; the product's shortcuts (product.json
// "people".tiles) and two-step sign-in.
import { api, run, toast } from "/assets/app.js";
import { empty, html, icon, openDialog, pill } from "/assets/kit/index.js";
import { fmt } from "./lib/format.js";
import { openPdf } from "./lib/pdf.js";
import { words } from "./lib/words.js";

const DAY = (d) => new Date(`${d}T00:00`);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const money = (v, c) => `${c} ${fmt(v || 0, 2)}`;

async function pinPad(title) {
  const box = document.createElement("div");
  box.innerHTML = String(html`<div class="my-pin"><div class="my-dots" data-dots>••••</div><div class="my-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) =>
    html`<button type="button" class="my-key" data-k="${k}" ${k === "" ? "disabled" : ""}>${k}</button>`)}</div></div>`);
  let pin = "";
  const dots = box.querySelector("[data-dots]");
  box.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => {
    pin = b.dataset.k === "⌫" ? pin.slice(0, -1) : (pin + b.dataset.k).slice(0, 8);
    dots.textContent = pin ? "●".repeat(pin.length) : "••••";
  });
  return await openDialog({ title, body: box, actions: [{ label: "Cancel", value: "" }, { label: "OK", value: "ok", primary: true }] }) === "ok" ? pin : null;
}

async function askLeave(d, again) {
  const box = document.createElement("form");
  box.innerHTML = String(html`<label>Kind<select name="type_id">${d.leave_types.map((t) => html`<option value="${t.type_id}">${t.name}</option>`)}</select></label>
    <div class="row"><label>From<input type="date" name="first" required></label><label>To<input type="date" name="last" required></label></div>
    <label class="check"><input type="checkbox" name="half_day"> Half day</label><label>Note<input name="note" maxlength="200"></label>`);
  if (await openDialog({ title: "Ask for leave", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Send", value: "ok", primary: true }] }) !== "ok") return;
  const v = Object.fromEntries(new FormData(box));
  if (await run(() => api("/my/leave", { method: "POST", body: { ...v, half_day: !!v.half_day } }), "Sent to your manager")) again();
}

async function myWork(el) {
  const d = await api("/my").catch((e) => ({ error: e }));
  if (d.error) {
    el.innerHTML = String(html`<div class="k-body">${empty({ icon: "user", title: "You are not on the team list yet", text: "Ask your manager to add you in Team with the same email you sign in with." })}</div>`);
    return;
  }
  const again = () => myWork(el);
  const max = Math.max(8, ...d.worked.map((w) => w.hours));
  el.innerHTML = String(html`<div class="my">
    <header class="my-hero"><div><small>Hello</small><h1>${d.employee.name.split(" ")[0]}</h1><span>${d.employee.position}${d.employee.sites.length ? ` · ${d.employee.sites.join(", ")}` : ""}</span></div>
      <button class="my-clock ${d.clocked_in ? "in" : ""}" data-clock><span class="my-ring"></span>${icon("clock", { size: 26 })}<b>${d.clocked_in ? "Clock out" : "Clock in"}</b></button></header>
    <section class="my-card"><h2>${icon("calendar")} My next shifts</h2>${d.shifts.length ? html`<div class="my-shifts">${d.shifts.map((s) => { const t = DAY(s.date);
        return html`<div class="my-shift"><div class="my-date"><small>${WD[t.getDay()]}</small><b>${t.getDate()}</b><small>${MON[t.getMonth()]}</small></div>
          <div><b>${s.start} - ${s.end}</b><br><span class="muted">${s.site}${s.role ? ` · ${s.role}` : ""}</span>${s.note ? html`<br><small>${s.note}</small>` : ""}</div></div>`; })}</div>`
      : html`<p class="muted">No shifts published for the next three weeks.</p>`}</section>
    <section class="my-card"><h2>${icon("chart")} Hours, last 14 days <span class="my-total">${d.hours_14d} h</span></h2>
      ${d.worked.length ? html`<div class="my-bars">${[...d.worked].reverse().map((w) => html`<div class="my-bar" title="${w.date}: ${w.in}-${w.out || "now"}"><i style="height:${(w.hours / max) * 100}%"></i><small>${w.date.slice(8)}</small></div>`)}</div>`
        : html`<p class="muted">Nothing clocked yet.</p>`}</section>
    <section class="my-card"><h2>${icon("coin")} My payslips</h2>${d.payslips.length ? html`<div class="my-list">${d.payslips.map((p) => html`<button class="my-row" data-slip="${p.month}">
        <span>${MON[Number(p.month.slice(5)) - 1]} ${p.month.slice(0, 4)}</span><b>${money(p.net, d.currency)}</b>${icon("download", { size: 16 })}</button>`)}</div>`
      : html`<p class="muted">Payslips appear here when the month is closed.</p>`}</section>
    <section class="my-card"><h2>${icon("sun")} My leave <button class="btn small primary" data-leave>Ask for leave</button></h2>
      <div class="my-rings">${d.balances.map((b) => { const left = Number(b.left ?? b.balance ?? 0), all = Number(b.allowance ?? b.entitled ?? left) || 1;
        return html`<div class="my-ringbox"><div class="my-donut" style="--p:${Math.max(0, Math.min(100, (left / all) * 100))}"><b>${left}</b></div><small>${b.name || b.type_name || b.type_id}</small></div>`; })}</div>
      ${d.leaves.length ? html`<div class="my-list">${d.leaves.slice(0, 6).map((l) => html`<div class="my-row"><span>${l.type_name} · ${l.first}${l.last !== l.first ? ` → ${l.last}` : ""}</span>
        ${pill(l.state, l.state === "approved" ? "good" : l.state === "pending" ? "warn" : "")}</div>`)}</div>` : ""}</section>
    <nav class="my-tiles">${words().tiles.map((t) => html`<a href="${t.href}">${icon(t.icon)}<span>${t.label}</span></a>`)}
      <a href="#/profile">${icon("lock")}<span>Two-step sign-in</span></a><a href="#/clock">${icon("users")}<span>Team clock</span></a></nav></div>`);
  el.querySelector("[data-clock]").onclick = async () => {
    const pin = await pinPad(d.clocked_in ? "Clock out - your PIN" : "Clock in - your PIN");
    if (pin === null) return;
    const out = await run(() => api("/my/clock", { method: "POST", body: { pin } }));
    if (out) { toast(out.clocked === "in" ? "Clocked in - have a good shift" : "Clocked out - thank you"); navigator.vibrate?.(60); again(); }
  };
  el.querySelectorAll("[data-slip]").forEach((b) => b.onclick = () => openPdf(`/my/payslips/${b.dataset.slip}/pdf`));
  el.querySelector("[data-leave]").onclick = () => askLeave(d, again);
}

export const routes = [
  { path: "/my", nav: "My work", key: "m", icon: "user", area: "team", group: "Daily", auth: "staff", tenant: true, render: myWork,
    keywords: "my shifts clock in payslip leave hours phone self service" },
];
