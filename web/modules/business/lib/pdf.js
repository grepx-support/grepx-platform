/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A PDF the BFF makes (payslip, statement, invoice ...) opened in a new tab - fetched with the sign-in, shown as a blob.
import { state, toast } from "/assets/app.js";

export async function openPdf(path) {
  const win = window.open("", "_blank");
  try {
    const res = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${state.session?.token}` } });
    if (!res.ok) throw new Error("Could not make the PDF");
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location = url; else location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { win?.close(); toast(e.message); }
}
