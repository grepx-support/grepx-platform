/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The product's own words for the shared people and funds screens (product.json "people"): what a place is called
// (outlet, store, branch), job titles and document kinds to suggest, the shortcuts on My work, what locking a payroll
// month also does. The shared screens never name a product.
import { state } from "/assets/app.js";

const DEFAULTS = {
  place: "place", places: "places",
  positions: ["Manager", "Supervisor", "Sales", "Cashier", "Accounts", "Driver", "Helper"],
  documents: ["ID card", "Work visa", "Driving licence", "First aid", "Contract"],
  tiles: [],                                    // [{href, icon, label}] on My work, before two-step sign-in and the team clock
  team_hint: "Add the people who work for you.",
  locked: "Month locked",                       // the toast after locking a payroll month
  fund_use: "e.g. a new branch",                // a use of fund money, as an example
  costs_hint: "",                               // how a use named like a place gets its real costs (empty: no costs link)
};

export const words = () => ({ ...DEFAULTS, ...(state.product?.people || {}) });
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
