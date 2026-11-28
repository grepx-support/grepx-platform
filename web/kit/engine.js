/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Which implementation draws each route while a product moves to React: "react" (its apps/web-src, built into modules/react/)
// or "legacy" (its vanilla modules). A product's modules/migration.js is one line of flags:
//   export const { engine, choose } = makeEngine("oceanstudio", { "/operations": "react", ... });
// Rolling a route back = its flag to "legacy" and redeploy. ?engine=legacy | react in the address switches one tab only
// (sessionStorage, gone when the tab closes); ?engine=off ends it.

export function makeEngine(product, flags) {
  const key = `${product}.engine`;
  try {
    const want = new URLSearchParams(location.search).get("engine");
    if (want === "off") sessionStorage.removeItem(key);
    else if (want === "legacy" || want === "react") sessionStorage.setItem(key, JSON.stringify({ "*": want }));
  } catch { /* storage off: flags only */ }
  const override = () => { try { return JSON.parse(sessionStorage.getItem(key) || "{}") || {}; } catch { return {}; } };
  if (Object.keys(override()).length) console.warn(`${product}: screen override active in this tab:`, override());

  /** "react" or "legacy" for one route (or tab, "/studio:packs"). */
  const engine = (path) => { const mine = override(); return mine[path] || mine["*"] || flags[path] || "legacy"; };

  /** A route's render: the React one when its flag says so (its bundle loads on first use), else the legacy one. */
  const choose = (path, legacy, loadReact) => async (el, q) => {
    if (engine(path) === "react") return (await loadReact()).renders[path](el, q);
    return legacy(el, q);
  };
  return { engine, choose, flags };
}
