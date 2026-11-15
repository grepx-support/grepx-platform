/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Funds: every fund and the business's money position (funds/overview), one fund in full (funds/fund).
import { fundPage } from "./funds/fund.js";
import { fundsPage } from "./funds/overview.js";

const base = { area: "funds", auth: "staff", tenant: true, perm: "manage_business" };
export const routes = [
  { ...base, path: "/funds", feature: "funds", nav: "Funds", icon: "coin", group: "Money", render: fundsPage, keywords: "funds capital investors partners portfolio loan grant money in pending" },
  { ...base, path: "/funds/fund", feature: "funds", render: fundPage, keywords: "fund detail" },
];
