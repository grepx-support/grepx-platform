/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// What the React screens use from the shell and the kit. These are imports of the files the browser already has
// (/assets/..., left out of the bundle by the build), so there is one session, one toast, one set of dialogs.
import { icon, initials as kitInitials, openDialog, openDrawer, confirm as kitConfirm, loadMapLibre, esc } from "/assets/kit/index.js";

export { api, can, run, state, store, toast } from "/assets/app.js";
export { esc, loadMapLibre, openDialog, openDrawer, kitInitials as initials, icon as kitIcon };
export const confirm = kitConfirm;
