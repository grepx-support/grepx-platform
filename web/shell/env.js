/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The environment badge in the top bar (the server's GREPX_ENV, carried in product.json "environment"): words and an
// icon, never colour alone - production stands out so nobody changes it thinking it is a test server.
import { html, icon } from "../kit/index.js";

const KNOWN = [
  [/^(prod|production|live)$/i, "Production", "bad", "alert"],
  [/^(stag|staging|stage|uat|preprod|pre-prod)$/i, "Staging", "warn", "clock"],
  [/^(dev|development|local|test|qa)$/i, "Development", "good", "settings"],
];

/** "prod" -> {label: "Production", tone: "bad", icon}; "" -> null; anything else as written. */
export function envBadge(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const hit = KNOWN.find(([re]) => re.test(n));
  return hit ? { label: hit[1], tone: hit[2], icon: hit[3] } : { label: n.slice(0, 24), tone: "info", icon: "info" };
}

/** Draws the badge into #env (nothing when the server names no environment). */
export function renderEnv(name, el = document.querySelector("#env")) {
  if (!el) return;
  const b = envBadge(name);
  el.innerHTML = b ? String(html`<span class="kit-env ${b.tone}" role="status" title="This server's environment">${icon(b.icon, { size: 13 })}${b.label}</span>`) : "";
}
