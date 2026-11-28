/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// A kit drawer whose content is a React tree: the drawer is the kit's (same panel, same Esc / click-outside behaviour), the body is ours.
import { mountRoute } from "./mount.js";
import { openDrawer } from "./shell.js";

/** openPanel({ title, width }, Component, props) -> the kit drawer; Component gets `drawer` among its props. */
export function openPanel({ title, width }, Component, props = {}) {
  const body = document.createElement("div");
  const drawer = openDrawer({ title, body, width });
  mountRoute(body, Component, { ...props, drawer });
  return drawer;
}
