/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A collection of setup items (instruments, sources, fields, jobs, runs...) - one way everywhere: find as you type, filter
// chips with counts (On / Off when items switch, plus the page's own), 100 at a time with "Show more", ticks for the bulk
// bar, switches that flip at once and save together, Edit / Remove / actions on each. Laid out by a view (views.jsx).
//   <Collection items={list} view={tableView(COLUMNS)} what="instruments" itemKey={(x) => x.id} text={(x) => ...}
//     save={(entries) => ...}            (optional: items switch on/off, saved in batches)
//     filters bulk actions edit remove edits sort find empty q filter lit manage onChange />
import { useMemo, useRef, useState } from "react";
import { Empty, Icon } from "../kit.jsx";
import { BulkBar } from "./BulkBar.jsx";
import { isOn, useSaver } from "./saver.js";

const PAGE = 100;
const ON_OFF = [{ id: "on", label: "On", test: isOn }, { id: "off", label: "Off", test: (x) => !isOn(x) }];
const byId = (x) => x.id;

function useSearch(initial, onChange, filterRef) {
  const [q, setQ] = useState(initial);
  const wait = useRef(null);
  const type = (text) => { clearTimeout(wait.current); wait.current = setTimeout(() => { setQ(text); onChange?.({ q: text, filter: filterRef.current }); }, 120); };
  return [q, type];
}

export function Collection(props) {
  const { items, view: View, itemKey = byId, text, sort, filters: own = [], bulk = [], actions = [], edit, remove, edits, save, find = "Find",
    empty = {}, what = "items", lit, manage = false, onChange } = props;
  const [filter, setFilter] = useState(props.filter || "");
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const [q, type] = useSearch(props.q || "", onChange, filterRef);
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState(() => new Set());
  const saver = useSaver({ save: save || (async () => {}), key: itemKey });
  const filters = useMemo(() => [...(save ? ON_OFF : []), ...own], [save, own]);

  const rows = useMemo(() => {
    const f = filters.find((y) => y.id === filter), needle = q.trim().toLowerCase();
    const order = sort || ((a, b) => String(itemKey(a)).localeCompare(String(itemKey(b))));
    return items.filter((x) => (!f || f.test(x)) && (!needle || text(x).toLowerCase().includes(needle))).sort(order);
  }, [items, filters, filter, q, sort, itemKey, text]);
  const counts = { "": items.length, ...Object.fromEntries(filters.map((f) => [f.id, items.filter(f.test).length])) };

  const pickOne = (id, on) => setPicked((p) => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });
  const pickMany = (list, on) => setPicked((p) => { const n = new Set(p); list.forEach((x) => (on ? n.add(itemKey(x)) : n.delete(itemKey(x)))); return n; });
  const selected = items.filter((x) => picked.has(itemKey(x)));
  const c = { key: itemKey, manage, picked, lit, switchable: Boolean(save), isOff: (x) => Boolean(save) && !isOn(x),
    edits: edits || { edit: Boolean(edit), remove: Boolean(remove) }, actions: (x) => actions.filter((a) => a.label && (!a.applies || a.applies(x))),
    pick: pickOne, pickAll: pickMany, flip: (x, on) => saver.set([x], on), edit, remove };

  const barActions = [
    ...(save ? [{ id: "on", label: `Switch on ${selected.filter((x) => !isOn(x)).length}`, icon: "play", tone: "primary", count: selected.filter((x) => !isOn(x)).length },
      { id: "off", label: `Switch off ${selected.filter(isOn).length}`, icon: "pause", count: selected.filter(isOn).length }] : []),
    ...bulk.map((b) => { const n = selected.filter(b.applies || (() => true)).length; return { ...b, count: n, label: `${b.label} ${n}` }; })];
  const act = async (a) => {
    if (a.id === "on" || a.id === "off") { saver.set(selected, a.id === "on"); setPicked(new Set()); return true; }
    const b = bulk.find((x) => x.id === a.id);
    const done = b ? await b.run(selected.filter(b.applies || (() => true))) : false;
    if (done) setPicked(new Set());
    return done;
  };
  const chip = (id, label) => (
    <button key={id || "all"} type="button" className={`sm-chip ${filter === id ? "on" : ""}`}
      onClick={() => { setFilter(id); setShown(PAGE); onChange?.({ q, filter: id }); }}>{label} <span>{counts[id]}</span></button>);
  const asked = q || filter;

  return (
    <>
      <div className="sm-filter sm-coll-bar"><label className="sm-inst-q"><Icon name="search" size={15} /><input type="search" placeholder={find} defaultValue={props.q || ""} aria-label="Find"
        onInput={(e) => { type(e.target.value); setShown(PAGE); }} /></label>
        {chip("", "All")}{filters.map((f) => chip(f.id, f.label))}<span className="muted small" aria-live="polite">{saver.note}</span></div>
      <div>{rows.length ? (
        <><View items={rows.slice(0, shown)} c={c} />
          {rows.length > shown ? <p className="sm-more"><button type="button" className="btn" onClick={() => setShown(shown + PAGE)}>Show more ({rows.length - shown} left)</button></p> : null}</>
      ) : <Empty icon={empty.icon || "list"} title={asked ? "Nothing matches" : empty.title || "Nothing yet"} text={asked ? "Change the search or the filter." : empty.text || ""} />}</div>
      <div>{manage ? <BulkBar count={picked.size} what={`${what} ticked`} actions={barActions} onAct={act}
        onAll={() => pickMany(rows.slice(0, shown), true)} onClear={() => setPicked(new Set())} /> : null}</div>
    </>
  );
}
