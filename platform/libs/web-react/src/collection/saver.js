/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Switching items on and off (anything with `enabled`): a flip shows at once, flips made within a moment are saved
// together in ONE call, and whatever the server refused flips back. The product hands in how to save:
//   const saver = useSaver({ save: (entries) => api("/bulk/instruments", { method: "POST", body: { entries } }), key })
import { useCallback, useRef, useState } from "react";
import { toast } from "../shell.js";

export const isOn = (x) => x.enabled !== false;

/** The saved body of an item with `enabled` set; its id is the entry's key, everything else is kept. */
export function bodyWith(x, on, idField = "id") {
  const { [idField]: _id, ...rest } = x;
  return { ...rest, enabled: on };
}

export function useSaver({ save, key = (x) => x.id, wait = 700 }) {
  const [note, setNote] = useState("");
  const [, bump] = useState(0);
  const pending = useRef(new Map()), timer = useRef(null), busy = useRef(false);

  const flush = useCallback(async () => {
    if (busy.current) { timer.current = setTimeout(flush, wait); return; }
    const batch = [...pending.current.values()].filter((p) => isOn(p.item) !== p.was);      // flipped back and forth = nothing
    pending.current.clear();
    if (!batch.length) { setNote(""); return; }
    busy.current = true;
    try {
      await save(batch.map((p) => ({ key: key(p.item), body: bodyWith(p.item, isOn(p.item)) })));
      const off = batch.filter((p) => !isOn(p.item)).length, on = batch.length - off;
      setNote(`Saved - ${on ? `${on} on` : ""}${on && off ? ", " : ""}${off ? `${off} off` : ""}. Used from the next run.`);
    } catch (err) {
      batch.forEach((p) => { p.item.enabled = p.was; });
      bump((n) => n + 1);
      setNote("");
      toast(`Not saved - ${err.message || "the sea refused"}`, "error");
    } finally {
      busy.current = false;
    }
  }, [save, key, wait]);

  const set = useCallback((items, on) => {
    for (const x of items) {
      if (isOn(x) === on) continue;
      if (!pending.current.has(key(x))) pending.current.set(key(x), { item: x, was: isOn(x) });
      x.enabled = on;
    }
    bump((n) => n + 1);
    setNote(`Saving ${pending.current.size}…`);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, wait);
  }, [flush, key, wait]);

  return { set, note };
}
