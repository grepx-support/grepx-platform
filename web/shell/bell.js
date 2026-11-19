/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The bell: every person's in-app messages (new job, job changed, a reminder...) with how many are new; opening it
// marks them read; a message opens what it is about. "Notify me on this device" turns on Web Push, so the phone or
// computer shows them even when the app is closed. New ones while the app is open also show as a toast.
import { api } from "./api.js";
import { state } from "./state.js";
import { toast } from "./toast.js";
import { html, icon } from "../kit/index.js";

const EVERY = 45000;
let timer = 0, last = -1, box = null;

const b64 = (s) => Uint8Array.from(atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const goTo = (link) => { if (!link) return; try { const u = new URL(link, location.origin); location.hash = u.hash || "#/"; } catch { location.hash = link; } };

async function pushOn() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return toast("This browser can't show notifications.");
  if (await Notification.requestPermission() !== "granted") return toast("Notifications are blocked - allow them for this site in the browser settings.");
  const reg = await navigator.serviceWorker.ready;
  const { public_key: key } = await api("/me/push/key");
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await api("/me/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), label: `${navigator.platform || "device"} ${new Date().toLocaleDateString()}` } });
  toast("Notifications on for this device ✓");
  paint(await api("/me/inbox"));
}

function paint(d) {
  const btn = box.querySelector("[data-bell]"), n = d.unread || 0;
  btn.querySelector("b").textContent = n > 99 ? "99+" : String(n);
  btn.classList.toggle("has", n > 0);
  const panel = box.querySelector(".bell-panel");
  if (panel.hidden) return;
  const pushed = "Notification" in window && Notification.permission === "granted";
  panel.innerHTML = String(html`<header><b>Messages</b>${pushed ? html`<small>${icon("check", { size: 12 })} this device notified</small>`
      : html`<button type="button" class="btn sm" data-push>${icon("bell", { size: 13 })} Notify me on this device</button>`}</header>
    ${d.items.length ? html`<ul>${d.items.map((m) => html`<li class="${m.new ? "new" : ""}"><button type="button" data-link="${m.link || ""}"><b>${m.subject}</b>
      <span>${m.body.split("\n").filter(Boolean).slice(0, 2).join(" · ")}</span><small>${ago(m.at)}</small></button></li>`)}</ul>`
      : html`<p class="muted">No messages yet.</p>`}`);
  panel.querySelector("[data-push]")?.addEventListener("click", () => pushOn().catch((e) => toast(e.message)));
  panel.querySelectorAll("[data-link]").forEach((x) => { x.onclick = () => { panel.hidden = true; goTo(x.dataset.link); }; });
}

async function poll() {
  clearTimeout(timer);
  if (!state.me || !box) return;
  try {
    const d = await api("/me/inbox");
    if (last >= 0 && d.unread > last && d.items[0]?.new) toast(`🔔 ${d.items[0].subject}`);
    last = d.unread;
    paint(d);
  } catch { /* offline for a moment: the next poll tries again */ }
  timer = setTimeout(poll, document.hidden ? EVERY * 4 : EVERY);
}

export function startBell(mount) {
  box = mount;
  return () => {
    clearTimeout(timer);
    if (!state.me) { box.innerHTML = ""; return; }
    box.innerHTML = String(html`<div class="bell"><button type="button" class="kit-iconbtn" data-bell aria-label="Messages">${icon("bell", { size: 18 })}<b>0</b></button>
      <div class="bell-panel" hidden></div></div>`);
    const btn = box.querySelector("[data-bell]"), panel = box.querySelector(".bell-panel");
    btn.onclick = async () => {
      panel.hidden = !panel.hidden;
      if (panel.hidden) return;
      const d = await api("/me/inbox");
      paint(d);
      if (d.unread) { await api("/me/inbox/seen", { method: "POST" }).catch(() => null); last = 0; btn.classList.remove("has"); btn.querySelector("b").textContent = "0"; }
    };
    document.addEventListener("click", (e) => { if (!box.contains(e.target)) box.querySelector(".bell-panel")?.setAttribute("hidden", ""); });
    poll();
  };
}
