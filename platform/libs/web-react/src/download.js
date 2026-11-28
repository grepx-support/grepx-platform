/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// A file from the API (an Excel export, a template) saved by the browser, signed in as the user.
import { state, toast } from "./shell.js";

export async function download(path, name, failed = "Could not make the file") {
  const res = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${state.session?.token}` } });
  if (!res.ok) return toast(failed);
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await res.blob()), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
