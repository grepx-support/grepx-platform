/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// Loading a page's data the way the legacy pages did: the skeleton while it loads, the shell's "Couldn't load this page" card
// when it fails (with the same words and a retry), then the page.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouteEl } from "./mount.js";

/** Run `fn` (returns a promise) when `deps` change. {data, error, loading, reload}; a late answer to an old request is dropped. */
export function useLoad(fn, deps) {
  const [state, set] = useState({ data: undefined, error: null, loading: true });
  const run = useRef(fn);
  run.current = fn;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    set((s) => ({ ...s, loading: true }));
    Promise.resolve().then(() => run.current()).then(
      (data) => { if (live) set({ data, error: null, loading: false }); },
      (error) => { if (live) set({ data: undefined, error, loading: false }); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

/** The card the shell shows when a page cannot load (its words, its retry, the trace for support). */
export function LoadError({ error, retry }) {
  const down = !error.status || error.status >= 500;
  const hint = down ? "A part of the system did not answer. Try again in a moment; if it keeps happening, the server may need its latest update"
    + " (the administrator runs the update and restart)." : error.message;
  return (
    <div className="card kit-loaderr"><h2>Couldn't load this page</h2><p>{hint}</p>
      {down && error.message && error.message !== "Something went wrong" ? <p className="muted small">{error.message}</p> : null}
      <p><button className="btn primary" onClick={retry}>Try again</button> <a className="btn" href="#/">Home</a></p>
      {error.trace ? <p className="muted small">trace {error.trace}</p> : null}</div>
  );
}

/** What a page shows until its data is here: the skeleton, or the load error. Children render once `ready`. */
export function Loaded({ state, children }) {
  if (state.error) return <LoadError error={state.error} retry={state.reload} />;
  if (state.loading && state.data === undefined) return <div className="kit-skeleton" />;
  return children(state.data);
}

/** Sets the page's colour area on the element the shell gave the route, as the legacy pages did. */
export function useArea(value) {
  const el = useRouteEl();
  useEffect(() => { el?.style.setProperty("--area", value); }, [el, value]);
}
