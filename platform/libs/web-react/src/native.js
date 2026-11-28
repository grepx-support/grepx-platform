/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// Legacy screens listen for the browser's own `change` event (fires when a box is left or Enter is pressed), React's onChange fires on every
// keystroke. This keeps the legacy timing: the latest handler runs on the element's native change event.
import { useEffect, useRef } from "react";

export function useNativeChange(ref, handler) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const on = (e) => latest.current(e);
    el.addEventListener("change", on);
    return () => el.removeEventListener("change", on);
  }, [ref]);
}
