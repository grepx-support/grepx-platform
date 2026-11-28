/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// Shared Setup tab (every product), first written for FleetWise.
// What every setup tab uses: saving, a drag-to-reorder list that remembers its order on the server, simple forms.
import { memo, useEffect, useRef } from "react";
import { SortableList } from "/assets/kit/index.js";
import { Icon } from "../../kit.jsx";
import { api, run } from "../../shell.js";

export const post = (path, body, done) => run(() => api(path, { method: "POST", body }), done);

/** Read a form into an object of strings (checkboxes: true / false). */
export function values(form) {
  const out = Object.fromEntries(new FormData(form));
  form.querySelectorAll("input[type=checkbox][name]").forEach((c) => { out[c.name] = c.checked; });
  return out;
}

/** A list the owner can drag into order: rows [{id, title, sub, tag, href, off}]. The kit moves the items; React draws them once. */
export const SortList = memo(function SortList({ rows, empty = "Nothing yet.", list }) {
  const ul = useRef(null);
  useEffect(() => {
    if (!ul.current) return undefined;
    const sort = new SortableList(ul.current, { onChange: (ids) => post(`/setup/${list}/order`, { location_ids: ids }, "Order saved") });
    return () => sort.destroy();
  }, [list]);
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="k-sort" ref={ul}>{rows.map((r) => (
      <li data-id={r.id} key={r.id} className={r.off ? "muted" : ""}>
        <button type="button" className="kit-grip" aria-label={`Move ${r.title} (arrow keys)`}><Icon name="grip" size={16} /></button>
        {r.img ? <img className="k-thumb" src={`/api/v1/media/${r.img}`} alt="" loading="lazy" /> : <span className="tag">{r.tag || ""}</span>}
        <span className="who"><b>{r.title}</b><small>{r.sub || ""}</small></span>{r.href ? <a className="btn small" href={r.href}>Edit</a> : null}</li>))}</ul>
  );
});
