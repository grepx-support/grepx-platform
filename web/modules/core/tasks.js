/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Planning board on the common task-service (all products).
import { api, esc, run, state } from "../../app.js";

const COLS = [["todo", "To do"], ["in_progress", "In progress"], ["blocked", "Blocked"], ["done", "Done"]];

export const routes = [{ path: "/tasks", nav: "Tasks", auth: "staff", render: async function draw(el, q) {
  const tasks = await api(`/tasks?scope=${q.scope || "mine"}${q.ref ? `&ref=${q.ref}` : ""}`);
  el.innerHTML = `<div class="row"><h1>Tasks</h1><span><a class="btn small" href="#/tasks?scope=mine">Mine</a> <a class="btn small" href="#/tasks?scope=all">Everyone</a></span></div>
    <form id="new" class="card row"><div><label>New task</label><input name="title" required></div><div><label>Due</label><input name="due_at" type="datetime-local"></div><button class="btn primary">Add</button></form><br>
    <div class="kanban">${COLS.map(([k, label]) => `<div class="col"><b>${label}</b> <span class="muted">${tasks.filter((t) => t.state === k).length}</span>
      ${tasks.filter((t) => t.state === k).map((t) => `<div class="item"><b>${esc(t.title)}</b> ${t.important ? "🔥" : ""}<div class="muted">${esc(t.ref_label || "General")} · ${esc((t.due_at || "").replace("T", " "))}</div>
      <div class="muted">${esc(t.assignee_name || "unassigned")}</div>
      <div>${COLS.filter(([s]) => s !== k).map(([s, l]) => `<button class="btn small" data-t="${t.id}" data-s="${s}">${l}</button>`).join(" ")}
      ${!t.assignee_id ? `<button class="btn small" data-claim="${t.id}">Claim</button>` : ""}</div></div>`).join("")}</div>`).join("")}</div>`;
  el.querySelectorAll("[data-s]").forEach((b) => b.onclick = async () => { await run(() => api(`/tasks/${b.dataset.t}/status`, { method: "POST", body: { state: b.dataset.s } })); draw(el, q); });
  el.querySelectorAll("[data-claim]").forEach((b) => b.onclick = async () => { await run(() => api(`/tasks/${b.dataset.claim}/claim`, { method: "POST", body: {} })); draw(el, q); });
  el.querySelector("#new").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target);
    await run(() => api("/tasks", { method: "POST", body: { title: f.get("title"), due_at: f.get("due_at") || undefined, assignee_id: state.me.id } }), "Task added"); draw(el, q); };
} }];
