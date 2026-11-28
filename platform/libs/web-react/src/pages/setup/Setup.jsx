/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Setup by the owner, the same page in every product. Each tab is a component; a product lists its tabs (most are shared):
//   <Setup q={q} tabs={[{ id: "business", label, icon, Tab, props }, ...]} />
// When fresh data arrives (after a save) the tab starts afresh, as the legacy redraw did.
import { useRef } from "react";
import { PageHead, Tabs } from "../../kit.jsx";
import { Loaded, useArea, useLoad } from "../../hooks.jsx";
import { area, head } from "../../areas.js";
import { api, state } from "../../shell.js";
import { ApiKeys } from "./ApiKeys.jsx";
import { Locations } from "./Locations.jsx";
import { Roles, Users } from "./People.jsx";

/** The tabs every product has, after its own: Locations, Users, Roles, API keys. */
export const COMMON_TABS = [{ id: "locations", label: "Depots & offices", icon: "pin", Tab: Locations }, { id: "users", label: "Users", icon: "users", Tab: Users },
  { id: "roles", label: "Roles", icon: "shield", Tab: Roles }, { id: "api", label: "API keys", icon: "lock", Tab: ApiKeys }];

export function Setup({ q = {}, tabs }) {
  const load = useLoad(() => api("/setup"), []);
  const seen = useRef({ data: null, epoch: 0 });
  if (load.data !== seen.current.data) seen.current = { data: load.data, epoch: seen.current.epoch + 1 };
  useArea(area("setup"));
  const shown = tabs.filter((t) => !t.feature || (state.me?.features || {})[t.feature] !== false);
  const tab = shown.find((t) => t.id === q.tab) || shown[0];
  return (
    <Loaded state={load}>{(s) => (
      <>
        <PageHead {...head("setup")} title="Setup" subtitle={s.business.name} />
        <Tabs list={shown.map((t) => ({ id: t.id, label: t.label, icon: t.icon, href: `#/setup?tab=${t.id}` }))} current={tab.id} />
        <div className="k-body"><tab.Tab key={`${tab.id}:${seen.current.epoch}`} s={s} q={q} redraw={load.reload} {...(tab.props || {})} /></div>
      </>
    )}</Loaded>
  );
}
