/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The demo requests from the public page, with a stage each - the same page in every product (platform operator).
import { showDetails } from "/assets/modules/business/lib/details.js";
import { stamp } from "/assets/modules/business/lib/format.js";
import { DataTable } from "../DataTable.jsx";
import { Empty, KpiRow, PageHead } from "../kit.jsx";
import { Loaded, useArea, useLoad } from "../hooks.jsx";
import { area, head } from "../areas.js";
import { api, run } from "../shell.js";

const STAGES = [["new", "New", "warn"], ["contacted", "Contacted", "info"], ["won", "Won", "good"], ["lost", "Lost", ""]];

export function Leads() {
  const load = useLoad(() => api("/platform/leads"), []);
  useArea(area("platform"));
  return (
    <Loaded state={load}>{({ leads: list }) => (
      <>
        <PageHead {...head("platform")} title="Demo requests" subtitle="From the public page. Each one is also emailed to the sales address." />
        <KpiRow items={STAGES.map(([k, t]) => ({ label: t, value: list.filter((l) => (l.stage || "new") === k).length, icon: k === "won" ? "check" : "user", area: area("platform") }))} />
        <section className="card k-section">{list.length ? (
          <div className="t"><DataTable onRow={(b) => showDetails(b.name, b)} rows={list} columns={[
            { key: "created_at", label: "When", render: (l) => stamp(l.created_at) },
            { key: "name", label: "Who", render: (l) => <><b>{l.name}</b><br /><span className="muted small">{l.company || ""}{l.size ? ` · ${l.size} branches` : ""}</span></> },
            { key: "email", label: "Contact", render: (l) => <><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone ? <><br /><span className="small">{l.phone}</span></> : null}</> },
            { key: "message", label: "Message", render: (l) => <span className="small">{l.message || ""}</span> },
            { key: "stage", label: "Stage", render: (l) => (
              <select aria-label="Stage" defaultValue={l.stage || "new"}
                onChange={(e) => run(() => api(`/platform/leads/${encodeURIComponent(l.id)}`, { method: "POST", body: { stage: e.target.value } }), "Saved")}>
                {STAGES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>) }]} /></div>
        ) : <Empty icon="user" title="No requests yet" text="They appear here when someone fills in the form on the public page." />}</section>
      </>
    )}</Loaded>
  );
}
