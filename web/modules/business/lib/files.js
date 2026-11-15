/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Choosing a file in the browser: open the picker, read it as a data URL (pictures) or as text / bytes (imports).
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept });
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

const read = (file, how) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r[how](file);
});

export const asDataUrl = (file) => read(file, "readAsDataURL");
export const asText = (file) => read(file, "readAsText");
