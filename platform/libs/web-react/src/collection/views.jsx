/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// How a collection lays out its items (Strategy): a table (columns) or cards. A view draws the items shown; the collection
// gives it `c` - what may be shown and the handlers (tick, switch, edit, remove, actions).
//   tableView([{ head, cell(item) -> node, cls }])      cardView({ head(item) -> node, body(item) -> node })
import { ItemActions, Switch, Tick } from "./parts.jsx";

function Controls({ x, c }) {
  return c.manage ? <ItemActions id={c.key(x)} item={x} edits={c.edits} actions={c.actions(x)} onEdit={c.edit} onRemove={c.remove} /> : null;
}

export function tableView(columns) {
  return function TableView({ items, c }) {
    return (
      <div className="sm-table-wrap"><table className="sm-dtable sm-coll"><thead><tr>
        {c.manage ? <th><input type="checkbox" aria-label="Tick all shown" checked={items.length > 0 && items.every((x) => c.picked.has(c.key(x)))} onChange={(e) => c.pickAll(items, e.target.checked)} /></th> : null}
        {c.switchable ? <th>On</th> : null}{columns.map((col, n) => <th key={n} className={col.cls || ""}>{col.head}</th>)}{c.manage ? <th /> : null}</tr></thead>
        <tbody>{items.map((x) => {
          const id = c.key(x);
          return (
            <tr key={id} data-item={id} className={c.isOff(x) ? "sm-off" : ""}>
              {c.manage ? <td><Tick id={id} picked={c.picked} onPick={c.pick} /></td> : null}
              {c.switchable ? <td><Switch item={x} id={id} manage={c.manage} onFlip={c.flip} /></td> : null}
              {columns.map((col, n) => <td key={n} className={col.cls || ""}>{col.cell(x)}</td>)}
              {c.manage ? <td className="sm-coll-acts"><Controls x={x} c={c} /></td> : null}</tr>
          );
        })}</tbody></table></div>
    );
  };
}

export function cardView(card) {
  return function CardView({ items, c }) {
    return (
      <div className="sm-cards">{items.map((x) => {
        const id = c.key(x);
        return (
          <div key={id} className={`card sm-card ${c.isOff(x) ? "sm-off" : ""} ${c.lit === id ? "sm-hl" : ""}`} data-item={id}>
            <div className="sm-card-h">{c.manage ? <Tick id={id} picked={c.picked} onPick={c.pick} /> : null}<span className="grow">{card.head(x)}</span>
              {c.switchable ? <Switch item={x} id={id} manage={c.manage} onFlip={c.flip} /> : null}</div>
            {card.body(x)}{c.manage ? <div className="sm-hbar sm-coll-foot"><Controls x={x} c={c} /></div> : null}</div>
        );
      })}</div>
    );
  };
}
