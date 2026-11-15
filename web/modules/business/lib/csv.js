/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Download rows as a CSV file (Excel opens it). Values with commas, quotes or new lines are quoted.
const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** download("audit.csv", [["When", "Who"], ...rows]) */
export function downloadCsv(name, rows) {
  const text = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type: "text/csv" })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
