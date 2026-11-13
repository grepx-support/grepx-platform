/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What a skill may use: the API (cached a short while), the person's permissions, formatting, and the app's pages.
import { api } from "../api.js";
import { visible, can } from "../session.js";
import { state } from "../state.js";

export function context(cache) {
  return {
    api: (path, seconds = 30) => cache.wrap(`api:${state.me?.id || ""}:${path}`, seconds, () => api(path)),
    can,
    me: () => state.me || {},
    pages: () => state.routes.filter((r) => r.nav && visible(r)),
    num: (n, digits = 1) => (n == null || Number.isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits })),
    money: (n, cur = state.me?.currency || "") => `${cur ? `${cur} ` : ""}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  };
}
