/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A vanilla widget inside a React page (a kit grid, a chart, an event feed, a legacy view not moved yet): `mount(el)` draws
// into the element and may return a cleanup; it runs again when `deps` change and the cleanup runs when the page is left.
// Keeps one page in React while a deep widget moves later, without writing HTML strings from React.
import { useEffect, useRef } from "react";

export function Widget({ mount, deps = [], className = "", tag: Tag = "div" }) {
  const box = useRef(null);
  const latest = useRef(mount);
  latest.current = mount;
  useEffect(() => {
    const el = box.current;
    let done = null, live = true;
    Promise.resolve(latest.current(el)).then((stop) => { if (live) done = stop; else if (typeof stop === "function") stop(); });
    return () => { live = false; if (typeof done === "function") done(); el?.replaceChildren(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <Tag ref={box} className={className} />;
}
