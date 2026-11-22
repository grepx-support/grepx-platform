/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The colour palettes the kit ships (their colours are in css/palettes.css). "brand" is the product's own colours
// from product.json. A product offers some of them with product.json "palettes": [...] (none listed = all).
export const PALETTES = [
  { id: "brand", label: "Default", about: "The product's own colours" },
  { id: "ocean", label: "Ocean", about: "Analytics blue, amber highlights" },
  { id: "terminal", label: "Terminal", about: "Trading-desk dark, green for up" },
  { id: "gold", label: "Gold", about: "Fintech gold on deep navy" },
  { id: "route", label: "Route", about: "Tracking blue, delivery orange" },
  { id: "bistro", label: "Bistro", about: "Appetising red, warm gold" },
  { id: "mint", label: "Mint", about: "Shop green, urgency orange" },
  { id: "care", label: "Care", about: "Calm medical teal, health green" },
  { id: "graphite", label: "Graphite", about: "Minimal black and white" },
];

/** The palettes a product offers, in its order; unknown names dropped, "brand" always first. */
export function offered(ids) {
  const known = new Map(PALETTES.map((p) => [p.id, p]));
  const list = (ids?.length ? ids : PALETTES.map((p) => p.id)).filter((id) => known.has(id) && id !== "brand");
  return [known.get("brand"), ...list.map((id) => known.get(id))];
}
