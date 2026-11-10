/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What the whole app shares: the product (product.json), the session token, the signed-in user (/me) and the routes.
function savedSession() {
  try { return JSON.parse(localStorage.getItem("session") || "null"); } catch (e) { return null; }
}

export const state = { product: null, session: savedSession(), me: null, routes: [] };
