/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Each area has a colour (product.json "areas") and an icon (product.json "icons", else these) - menu, headers, tiles.
import { state } from "/assets/app.js";

const ICONS = { home: "home", team: "users", funds: "coin", setup: "settings", platform: "building", stock: "box", money: "receipt" };

export const area = (name) => state.product?.areas?.[name] || "var(--primary)";
export const areaIcon = (name) => state.product?.icons?.[name] || ICONS[name] || "dot";

/** Page header props for an area: pageHead({...head("team"), title, subtitle}) */
export const head = (name) => ({ area: area(name), icon: areaIcon(name) });
