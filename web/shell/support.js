/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Support mode: a platform admin opens one organisation with a short-lived support session, sees a banner while inside,
// and "Exit" (or the session running out) brings back their own platform session.
import { esc } from "../kit/index.js";
import { login } from "./session.js";
import { state } from "./state.js";

const KEY = "support.return";

const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
const keep = (s) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ } };

/** Enter an organisation with the session the server issued ({token, tenant, read_only, ...}); `name` is shown in the banner. */
export async function enterSupport(session, name) {
  if (!state.me?.support) keep(state.session);
  await login({ ...session, support_name: name });
  location.hash = "#/";
}

/** Back to the admin's own session (also used when the support session expires). Returns false when there is none. */
export async function exitSupport() {
  const back = saved();
  if (!back) return false;
  keep(null);
  await login(back);
  location.hash = "#/";
  return true;
}

export function supportBanner() {
  const bar = document.querySelector("#support");
  if (!bar) return;
  const me = state.me;
  bar.hidden = !me?.support;
  document.body.classList.toggle("in-support", !!me?.support);
  if (!me?.support) return;
  bar.innerHTML = `<span>Viewing <b>${esc(state.session?.support_name || "this organisation")}</b> as platform support
    · ${me.read_only ? "read only" : "<b>changes are saved under your name</b>"}</span><button type="button" class="btn small">Exit</button>`;
  bar.querySelector("button").onclick = exitSupport;
}
