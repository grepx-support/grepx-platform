/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// My profile (every product): picture with crop, who I am, and the keyboard shortcuts. Opened from the name in the top bar.
import { api, renderNav, run, state } from "../../app.js";
import { avatar, html, icon, openDialog, PhotoPicker, photoUrl } from "../../kit/index.js";
import { loadMe } from "../../shell/session.js";
import { SHORTCUTS } from "../../shell/finder/shortcuts.js";

async function changePhoto(me) {
  const picker = new PhotoPicker({ current: me.photo_id ? photoUrl(me.photo_id) : "" });
  const box = document.createElement("div");
  picker.mount(box);
  const choice = await openDialog({ title: "Profile picture", body: box,
    actions: [...(me.photo_id ? [{ label: "Remove", value: "remove" }] : []), { label: "Cancel", value: "" }, { label: "Save", value: "save", primary: true }] });
  if (choice === "remove") return run(() => api("/me/photo", { method: "DELETE" }), "Picture removed");
  const image = choice === "save" ? picker.toDataURL() : "";
  return image ? run(() => api("/me/photo", { method: "POST", body: { image } }), "Looking good") : null;
}

function view(me) {
  const role = me.tenant ? (me.business_name || "Team") : me.role === "admin" ? "Platform operator" : me.role;
  return html`<section class="kit-profile">
    <div class="kit-profilebanner" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="kit-profilehead">
      <button type="button" class="kit-profilepic" data-photo aria-label="Change profile picture">
        ${avatar(me.name || me.email || "?", { photo: me.photo_id, size: 132, ring: true })}<span class="kit-profilecam">${icon("camera", { size: 18 })}</span></button>
      <div><h1>${me.name || me.email}</h1><p class="muted">${role}${me.support ? " · support mode" : ""}</p></div>
    </div>
    <div class="grid two">
      <section class="card"><h2>${icon("user")} Details</h2><dl class="kit-facts">
        <dt>Email</dt><dd>${me.email || "-"}</dd><dt>Phone</dt><dd>${me.phone || "-"}</dd>
        <dt>Access</dt><dd>${(me.perms || []).includes("*") ? "Everything" : `${(me.perms || []).length} permissions`}</dd></dl>
        <p><a class="btn" href="#/security">${icon("lock", { size: 15 })} Sign-in & security</a></p></section>
      <section class="card"><h2>${icon("keyboard")} Shortcuts</h2><dl class="kit-facts kit-keys">
        ${SHORTCUTS.map(([keys, what]) => html`<dt>${keys.map((k) => html`<kbd>${k}</kbd>`)}</dt><dd>${what}</dd>`)}</dl></section>
    </div></section>`;
}

async function profile(el) {
  const me = state.me;
  el.innerHTML = String(view(me));
  el.querySelector("[data-photo]").onclick = async () => {
    if (await changePhoto(me)) { await loadMe(); renderNav(); profile(el); }
  };
}

export const routes = [{ path: "/profile", auth: "user", render: profile }];
