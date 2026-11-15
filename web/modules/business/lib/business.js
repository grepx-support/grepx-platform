/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The signed-in user's business (name, currency, modules, locations) - loaded once and shared by every screen.
import { api, renderNav, state } from "/assets/app.js";

let cached = null;

export async function biz(fresh = false) {
  if (!cached || fresh) {
    cached = await api("/me/business");
    document.documentElement.dataset.currency = cached.business?.currency || "";      // money reads in the business's own grouping
    if (state.me && cached.business?.name && state.me.business_name !== cached.business.name) {
      state.me.business_name = cached.business.name;           // shown under the user's name in the top bar
      renderNav();
    }
  }
  return cached;
}

export const resetBiz = () => { cached = null; };

/** The user holds this permission (or all of them). */
export const has = (perm) => !!state.me && ((state.me.perms || []).includes(perm) || (state.me.perms || []).includes("*"));

/** A business feature (counter, trade, crm, transfers ...) is switched on. */
export const on = (b, module) => (b.business?.modules || {})[module] !== false;

/** A page renderer that first has the business (its currency decides how money reads). */
export const withBiz = (render) => async (...args) => { await biz(); return render(...args); };
