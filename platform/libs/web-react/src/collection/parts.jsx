/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The controls every item of a collection may carry - one look everywhere: tick, the on/off switch, Edit, its own actions,
// Remove. Same elements and class names as the vanilla collection (studio.css applies as is).
import { Icon } from "../kit.jsx";
import { isOn } from "./saver.js";

export const Tick = ({ id, picked, onPick, label }) => (
  <input type="checkbox" className="sm-pack-pick" checked={picked.has(id)} aria-label={`Select ${label || id}`} onChange={(e) => onPick(id, e.target.checked)} />
);

export function Switch({ item, id, manage, onFlip }) {
  const on = isOn(item);
  return (
    <button type="button" className={`sm-switch ${on ? "on" : ""}`} role="switch" aria-checked={on} disabled={!manage} aria-label={`${id} ${on ? "on" : "off"}`}
      title={on ? "On - click to switch off" : "Off - skipped everywhere. Click to switch on"} onClick={() => onFlip(item, !on)}><i /></button>
  );
}

export function ItemActions({ id, item, edits, actions, onEdit, onRemove }) {
  return (
    <span className="sm-item-acts">
      {edits.edit ? <button type="button" className="btn small" aria-label={`Edit ${id}`} title="Edit its settings" onClick={() => onEdit(item)}><Icon name="edit" size={13} /> Edit</button> : null}
      {actions.map((a) => <button type="button" key={a.id} className="btn small" title={a.title || a.label} onClick={() => a.run(item)}>{a.icon ? <Icon name={a.icon} size={13} /> : null} {a.label}</button>)}
      {edits.remove ? <button type="button" className="btn small sm-quiet-danger" aria-label={`Remove ${id}`} onClick={() => onRemove(item)}><Icon name="x" size={13} /></button> : null}
    </span>
  );
}
