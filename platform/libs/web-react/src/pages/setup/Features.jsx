/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Setup -> Features, the same tab in every product: switch whole parts of the app on or off; each lists the pages it brings.
// A product passes its list: [[key, name, icon, what it does], ...] and the word for itself ("business", "organisation").
import { resetBiz } from "/assets/modules/business/lib/business.js";
import { Icon } from "../../kit.jsx";
import { api, run, state } from "../../shell.js";

function Pages({ feature }) {
  const list = (state.routes || []).filter((r) => r.feature === feature && r.nav);
  return list.length ? <div className="ft-pages">{list.map((r) => <a className="ft-page" href={`#${r.path}`} key={r.path}><Icon name={r.icon || "dot"} size={12} /> {r.nav}</a>)}</div> : null;
}

export function Features({ s, features = [], noun = "business" }) {
  const on = s.business.modules || {};
  const change = async (e) => {
    const modules = { [e.target.name]: e.target.checked };
    if (await run(() => api("/setup/business", { method: "PATCH", body: { modules } }), "Saved")) { resetBiz(); location.reload(); }
  };
  return (
    <>
      <p className="muted">Switch on what your {noun} uses. What is off leaves the menu for everyone; nothing is deleted.</p>
      <form className="grid two" onChange={change}>{features.map(([key, name, ic, what]) => (
        <div className={`card ft-row ${on[key] !== false ? "on" : ""}`} key={key}>
          <label className="ft-switch"><input type="checkbox" name={key} defaultChecked={on[key] !== false} /><span className="ft-knob"></span></label>
          <div><b><Icon name={ic} size={16} /> {name}</b><br /><small className="muted">{what}</small><Pages feature={key} /></div></div>))}</form>
    </>
  );
}
