/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What the finder can find. Each source answers find(query) -> [{ title, hint, href, icon, area, group }]; the finder
// knows nothing of products. New kinds of result = a new source (pages, recent, a module's records...).
import { areaOf } from "../nav.js";
import { allowed, visible } from "../session.js";
import { state } from "../state.js";
import { rank } from "./score.js";

/** Every page in the menu the user may open. */
export class PageSource {
  group = "Pages";
  async find(query) {
    const pages = state.routes.filter((r) => r.nav && visible(r)).map((r) => ({ title: r.nav, hint: r.group || "", href: `#${r.path}`,
      icon: r.icon, area: areaOf(r), key: r.key, keywords: `${r.group || ""} ${r.keywords || ""}` }));
    return rank(query, pages).slice(0, query ? 8 : 6);
  }
}

/** Quick actions a module declares: export const actions = [{ title, href, icon, perm, keywords }]. */
export class ActionSource {
  group = "Actions";
  constructor(actions) { this.actions = actions; }
  async find(query) {
    const mine = this.actions.filter((a) => allowed({ auth: "staff", perm: a.perm }));
    return query ? rank(query, mine).slice(0, 6) : mine.slice(0, 4);
  }
}

/** The last pages opened, newest first (kept per browser). */
export class RecentSource {
  group = "Recent";
  constructor(store, max = 6) { Object.assign(this, { store, max }); }
  list() { return this.store.get("finder.recent", []); }
  remember(item) {
    if (!item?.title) return;
    this.store.set("finder.recent", [item, ...this.list().filter((r) => r.href !== item.href)].slice(0, this.max));
  }
  async find(query) { return query ? [] : this.list(); }
}

/** Records a product module can search: export async function search(query) -> items (it does its own API call). */
export class ModuleSource {
  constructor(group, search) { Object.assign(this, { group, search }); }
  async find(query) {
    if (query.trim().length < 2) return [];
    try { return (await this.search(query)).slice(0, 6); } catch (e) { return []; }
  }
}
