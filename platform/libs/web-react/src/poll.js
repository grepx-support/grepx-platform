/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What a page polls: run `fn` every `every` ms while the page is on screen and the browser tab is visible; a hidden tab
// waits, coming back refreshes at once. Stops when the component unmounts (the route left).
import { useEffect, useRef } from "react";

export function usePoll(fn, every, deps = []) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    let timer = null, stopped = false;
    const tick = () => { if (stopped) return; if (!document.hidden) latest.current(); timer = setTimeout(tick, every); };
    const back = () => { if (!document.hidden && !stopped) { clearTimeout(timer); latest.current(); timer = setTimeout(tick, every); } };
    timer = setTimeout(tick, every);
    document.addEventListener("visibilitychange", back);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", back); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [every, ...deps]);
}
