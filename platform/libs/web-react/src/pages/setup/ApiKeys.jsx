/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// Shared Setup tab (every product), first written for FleetWise.
// Setup -> API keys: keys for other systems (website, POS, a spreadsheet script). Read keys only look; write keys can change things.
// The full key shows once; revoke any time.
import { Empty, Icon, Pill } from "../../kit.jsx";
import { Loaded, useLoad } from "../../hooks.jsx";
import { mountRoute } from "../../mount.js";
import { api, openDialog, run, toast } from "../../shell.js";

function Made({ keyInfo }) {
  return (
    <>
      <p><b>Copy this key now</b> - it is not shown again.</p><pre className="ak-key">{keyInfo.key}</pre>
      <p className="muted small">Send it with every call as the header <code>X-Api-Key</code>. Example:</p>
      <pre className="ak-ex">curl -H "X-Api-Key: {keyInfo.key}" {location.origin}/api/v1/stock/items</pre>
    </>
  );
}

async function made(key) {
  const box = document.createElement("div");
  mountRoute(box, Made, { keyInfo: key });
  const v = await openDialog({ title: `Key for ${key.name}`, body: box, actions: [{ label: "Copy", value: "copy" }, { label: "Done", value: "", primary: true }] });
  if (v === "copy") navigator.clipboard?.writeText(key.key).then(() => toast("Copied"));
}

export function ApiKeys({ redraw }) {
  const load = useLoad(() => api("/setup/api-keys"), []);
  return (
    <Loaded state={load}>{(d) => {
      const create = async (e) => {
        e.preventDefault();
        const f = e.target;
        const key = await run(() => api("/setup/api-keys", { method: "POST", body: { name: f.name.value, scope: f.scope.value } }));
        if (key) { await made(key); redraw(); }
      };
      return (
        <>
          <section className="card accent"><h2><Icon name="lock" /> Connect other systems</h2>
            <p className="muted">A key lets your website, till or a script use the same data as this app. <a href="/docs" target="_blank" rel="noopener">See every call →</a></p>
            <form className="row" onSubmit={create}><label className="grow">Name<input name="name" required placeholder="e.g. Website orders" /></label>
              <label>Can<select name="scope"><option value="read">only read</option><option value="write">read and change</option></select></label>
              <button className="btn primary"><Icon name="plus" size={16} /> Make a key</button></form></section>
          <section className="card k-section">{d.keys.length ? (
            <table className="m-view"><thead><tr><th>Name</th><th>Can</th><th>Key</th><th>Made</th><th></th></tr></thead>
              <tbody>{d.keys.map((k) => (
                <tr key={k.key_id} className={k.active ? "" : "muted"}><td><b>{k.name}</b></td><td><Pill tone={k.scope === "write" ? "warn" : "info"}>{k.scope === "write" ? "read and change" : "read"}</Pill></td>
                  <td><code>gx_{k.key_id}_••••</code></td><td>{String(k.created_at).slice(0, 10)} {k.created_by ? `by ${k.created_by}` : ""}</td>
                  <td className="end">{k.active ? (
                    <button className="btn small danger" onClick={async () => {
                      if (window.confirm("Revoke this key? Anything using it stops working at once.") && await run(() => api(`/setup/api-keys/${k.key_id}`, { method: "DELETE" }), "Revoked")) redraw();
                    }}>Revoke</button>) : <Pill>{`revoked ${String(k.revoked_at).slice(0, 10)}`}</Pill>}</td></tr>))}</tbody></table>
          ) : <Empty icon="lock" title="No keys yet" text="Make one when another system needs to read or send data." />}</section>
        </>
      );
    }}</Loaded>
  );
}
