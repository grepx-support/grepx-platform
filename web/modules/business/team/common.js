/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What the team pages share: the frame with tabs, place names, weeks.
import { html, pageHead, tabs } from "/assets/kit/index.js";
import { area, head } from "../lib/areas.js";

const TABS = [{ id: "people", label: "People", icon: "users", href: "#/team" }, { id: "roster", label: "Roster", icon: "calendar", href: "#/roster" },
  { id: "leave", label: "Leave", icon: "inbox", href: "#/leave" }, { id: "payroll", label: "Payroll", icon: "coin", href: "#/payroll" },
  { id: "clock", label: "Clock in / out", icon: "clock", href: "#/clock" }];

export function frame(el, current, title, subtitle, actions = "") {
  el.style.setProperty("--area", area("team"));
  el.innerHTML = String(html`${pageHead({ ...head("team"), title, subtitle, actions })}${tabs(TABS, current)}<div class="k-body"></div>`);
  return el.querySelector(".k-body");
}

export const siteName = (b, id) => b.locations.find((l) => l.id === id)?.name || "-";
export const DAY = 864e5;
export const monday = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return new Date(d - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10); };
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const hours = (m) => `${Math.round((m / 60) * 10) / 10} h`;
