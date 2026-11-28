/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// The six state words: each in words with its tone; an unknown word is "Unknown", never healthy; the reason is readable.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { STATES, StateBadge } from "../src/state.jsx";

describe("StateBadge", () => {
  it("says every state in words, and an unknown one as Unknown", () => {
    expect(Object.keys(STATES)).toEqual(["healthy", "degraded", "failed", "unavailable", "unknown", "stale"]);
    const { container } = render(<div><StateBadge state="stale" why="2 days behind" /><StateBadge state="weird" /></div>);
    const [stale, weird] = container.querySelectorAll(".kit-state");
    expect(stale.textContent).toBe("Stale - 2 days behind");
    expect(stale.className).toMatch(/warn/);
    expect(stale.title).toBe("2 days behind");
    expect(weird.textContent).toBe("Unknown");
    expect(screen.getByText("Unknown").closest("span").dataset.state).toBe("unknown");
  });
});
