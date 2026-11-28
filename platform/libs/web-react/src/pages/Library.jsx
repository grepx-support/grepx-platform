/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The file library, the same page in every product: every file attached anywhere in the business as cards, filtered by the
// kind of record, searched by name, opened, or followed to its record. A product passes its kinds and its empty-state words:
//   <Library q={q} kinds={{ sea: ["Seas", "#/studio/"] }} emptyText="Files attached to seas and people show up here." />
import { useRef } from "react";
import { openAttachment } from "/assets/modules/business/lib/attachments.js";
import { Empty, Icon, PageHead, Pill } from "../kit.jsx";
import { Loaded, useArea, useLoad } from "../hooks.jsx";
import { useNativeChange } from "../native.js";
import { area, head } from "../areas.js";
import { api } from "../shell.js";

const kindOf = (ref) => ref.split(":")[0];

function Search({ pick, initial }) {
  const box = useRef(null);
  useNativeChange(box, (e) => { location.hash = `#/files?${pick ? `kind=${pick}&` : ""}q=${encodeURIComponent(e.target.value)}`; });
  return <input type="search" placeholder="Search file names" defaultValue={initial} ref={box} className="grow" />;
}

export function Library({ q = {}, kinds: KIND = {}, emptyText = "Files attached to records show up here." }) {
  const load = useLoad(() => api("/attachments"), []);
  useArea(area("setup"));
  return (
    <Loaded state={load}>{({ files }) => {
      const kinds = [...new Set(files.map((f) => kindOf(f.ref)))];
      const pick = q.kind || "", text = (q.q || "").toLowerCase();
      const shown = files.filter((f) => (!pick || kindOf(f.ref) === pick) && (!text || f.name.toLowerCase().includes(text) || (f.note || "").toLowerCase().includes(text)));
      const byId = Object.fromEntries(files.map((f) => [f.id, f]));
      return (
        <>
          <PageHead {...head("setup")} title="Files" subtitle={`${files.length} file${files.length === 1 ? "" : "s"} attached across the business`} />
          <div className="k-body"><div className="card row fl-bar"><Search pick={pick} initial={q.q || ""} />
            <a className={`btn small ${pick ? "" : "primary"}`} href="#/files">All</a>
            {kinds.map((k) => <a key={k} className={`btn small ${pick === k ? "primary" : ""}`} href={`#/files?kind=${k}`}>{(KIND[k] || [k])[0]}</a>)}</div>
          {shown.length ? (
            <div className="at-grid fl-grid">{shown.map((f) => (
              <div className="at-card" key={f.id} onClick={(e) => { if (!e.target.closest("[data-go]")) openAttachment(byId[f.id]); }}>
                <div className="at-thumb"><Pill tone="info">{f.type.split("/").pop().slice(0, 6).toUpperCase()}</Pill></div><div className="at-name">{f.name}</div>
                <div className="at-meta muted">{String(f.at).slice(0, 10)} · {f.by}</div>
                {KIND[kindOf(f.ref)] ? <a className="small" href={`${KIND[kindOf(f.ref)][1]}${f.ref.split(":")[1]}`} data-go><Icon name="arrow" size={12} /> {KIND[kindOf(f.ref)][0].replace(/s$/, "")}</a> : null}</div>))}</div>
          ) : <Empty icon="upload" title="No files yet" text={emptyText} />}</div>
        </>
      );
    }}</Loaded>
  );
}
