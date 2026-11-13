/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// avatar(name, { photo, size, ring, status }) - the person's picture, or their initials on a colour that is always the
// same for the same name. Pure function: no state, no requests (the picture is a cached media URL).
import { html } from "../core/dom.js";

const PALETTE = [["#f97316", "#ec4899"], ["#0ea5e9", "#6366f1"], ["#14b8a6", "#22c55e"], ["#8b5cf6", "#d946ef"],
  ["#f59e0b", "#ef4444"], ["#06b6d4", "#3b82f6"], ["#84cc16", "#10b981"], ["#e11d48", "#7c3aed"]];

/** A small stable hash: the same name always lands on the same colours. */
export function hue(text = "") {
  let h = 0;
  for (const c of text) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const initials = (name = "") => name.trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

export const photoUrl = (id) => (id ? `/api/v1/media/${encodeURIComponent(id)}` : "");

export function avatar(name = "", { photo = "", size = 36, ring = false, status = "", label = false } = {}) {
  const [a, b] = hue(name);
  const style = `--av:${size}px;--av-a:${a};--av-b:${b}`;
  const face = photo ? html`<img src="${photoUrl(photo)}" alt="" loading="lazy" decoding="async">` : html`<b>${initials(name)}</b>`;
  return html`<span class="kit-avatar ${ring ? "ring" : ""}" style="${style}" ${label ? html`role="img" aria-label="${name}"` : html`aria-hidden="true"`}>${face}${
    status ? html`<i class="kit-avstatus ${status}"></i>` : ""}</span>`;
}

/** A row of overlapping faces: avatarStack([{name, photo}], 4) -> "+3" for the rest. */
export function avatarStack(people, max = 4, size = 28) {
  const shown = people.slice(0, max);
  return html`<span class="kit-avstack">${shown.map((p) => avatar(p.name, { photo: p.photo_id || p.photo, size }))}${
    people.length > max ? html`<span class="kit-avatar more" style="--av:${size}px"><b>+${people.length - max}</b></span>` : ""}</span>`;
}
