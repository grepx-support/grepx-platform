/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Attachments on any record: a drop zone (drag files in, or click to choose), the files as cards with a preview for
// pictures, click to open, x to remove. mountAttachments(el, "bill:123") anywhere.
import { api, run, state, toast } from "/assets/app.js";
import { html, icon } from "/assets/kit/index.js";
import { asDataUrl } from "./files.js";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx,.csv,.txt";
const BADGE = { "application/pdf": ["PDF", "#dc2626"], "text/csv": ["CSV", "#16a34a"], "text/plain": ["TXT", "#64748b"] };
const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function blobOf(f) {
  const res = await fetch(f.url, { headers: { Authorization: `Bearer ${state.session?.token}` } });
  if (!res.ok) throw new Error("Could not open the file");
  return URL.createObjectURL(await res.blob());
}

function badge(f) {
  const [t, c] = BADGE[f.type] || (f.type.includes("word") ? ["DOC", "#2563eb"] : f.type.includes("sheet") ? ["XLS", "#16a34a"] : f.type.includes("presentation") ? ["PPT", "#ea580c"] : ["FILE", "#64748b"]);
  return html`<span class="at-badge" style="background:${c}">${t}</span>`;
}

export async function openAttachment(f) {
  try { const url = await blobOf(f); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 120000); } catch (e) { toast(e.message); }
}

export async function mountAttachments(el, ref, { title = "Attachments" } = {}) {
  if (!el) return;
  const draw = async () => {
    const { files } = await api(`/attachments?ref=${encodeURIComponent(ref)}`).catch(() => ({ files: [] }));
    el.innerHTML = String(html`<section class="card k-section at"><h2>${icon("upload")} ${title} <small class="muted">${files.length || ""}</small></h2>
      <div class="at-grid">${files.map((f) => html`<div class="at-card" data-open="${f.id}" title="${f.name}">
          <div class="at-thumb" data-thumb="${f.type.startsWith("image/") ? f.id : ""}">${f.type.startsWith("image/") ? "" : badge(f)}</div>
          <div class="at-name">${f.name}</div><div class="at-meta muted">${size(f.size)} · ${f.by || ""} · ${String(f.at).slice(0, 10)}</div>
          <button class="kit-iconbtn at-del" data-del="${f.id}" aria-label="Remove">${icon("x", { size: 14 })}</button></div>`)}
        <label class="at-drop" tabindex="0">${icon("upload", { size: 22 })}<span>Drop files here or <u>choose</u></span><small class="muted">PDF, photos, Word, Excel, CSV · 10 MB</small>
          <input type="file" multiple accept="${ACCEPT}" hidden></label></div></section>`);
    const byId = Object.fromEntries(files.map((f) => [f.id, f]));
    el.querySelectorAll("[data-thumb]").forEach(async (t) => { if (t.dataset.thumb) { try { t.style.backgroundImage = `url(${await blobOf(byId[t.dataset.thumb])})`; } catch { /* no preview */ } } });
    el.querySelectorAll("[data-open]").forEach((c) => c.onclick = (e) => { if (!e.target.closest("[data-del]")) openAttachment(byId[c.dataset.open]); });
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (confirm(`Remove ${byId[b.dataset.del].name}?`) && await run(() => api(`/attachments/${b.dataset.del}`, { method: "DELETE" }), "Removed")) draw(); });
    const drop = el.querySelector(".at-drop"), input = drop.querySelector("input");
    const send = async (list) => {
      for (const file of list) {
        if (file.size > 10 * 1048576) { toast(`${file.name} is over 10 MB`); continue; }
        await run(async () => api("/attachments", { method: "POST", body: { ref, name: file.name, data: await asDataUrl(file) } }), `Attached ${file.name}`);
      }
      draw();
    };
    input.onchange = () => send([...input.files]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); send([...e.dataTransfer.files]); };
  };
  await draw();
}
