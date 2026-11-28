/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Each area of the app has a colour (product.json "areas") and an icon - used by headers, tiles and charts. A product adds
// its own area icons with addAreaIcons({ seas: "cube" }) once, in its entry.
import { state } from "./shell.js";

const ICONS = { home: "home", jobs: "clipboard", dispatch: "send", fleet: "truck", drivers: "users", leave: "calendar", contractors: "truck", pricing: "coin",
  billing: "receipt", reports: "trend", customers: "users", transfers: "swap", imei: "search", crm: "trend", deals: "coin", setup: "settings", platform: "building",
  owed: "alert", purchases: "cart", warehouse: "layout", approvals: "check", ai: "sparkle", seas: "cube", markets: "trend" };

export const addAreaIcons = (more) => Object.assign(ICONS, more);
export const area = (name) => state.product?.areas?.[name] || "var(--primary)";
export const areaIcon = (name) => ICONS[name] || "dot";
/** Page header props for an area: <PageHead {...head("fleet")} title=... /> */
export const head = (name) => ({ area: area(name), icon: areaIcon(name) });
