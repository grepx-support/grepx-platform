/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The bar that shows while items are ticked: the actions (each enabled only for the items it applies to), Select all
// shown, Clear. An action's run returns true when done (the ticks clear).
import { useState } from "react";
import { Icon } from "../kit.jsx";

export function BulkBar({ count, what, actions, onAct, onAll, onClear }) {
  const [busy, setBusy] = useState("");
  if (!count) return null;
  const go = async (a) => { setBusy(a.id); if (!(await onAct(a))) setBusy(""); else setBusy(""); };
  return (
    <div className="sm-bulkbar" role="region" aria-label={what}><b>{count} {what}</b>
      {actions.map((a) => <button key={a.id} className={`btn small ${a.tone || ""}`} disabled={!a.count || busy === a.id} onClick={() => go(a)}>{a.icon ? <Icon name={a.icon} size={12} /> : null} {a.label}</button>)}
      <button className="btn small" onClick={onAll}>Select all shown</button><button className="btn small" onClick={onClear}>Clear</button></div>
  );
}
