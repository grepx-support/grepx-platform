/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// F-8: a mounted page is unmounted when the shell replaces its element, and nothing keeps running after many visits.
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { mountRoute, mounted } from "../src/mount.js";

let live = 0;
function Ticker() {
  useEffect(() => {
    live += 1;
    const t = setInterval(() => {}, 1000);
    return () => { clearInterval(t); live -= 1; };
  }, []);
  return <p>page</p>;
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });

describe("mountRoute", () => {
  it("draws the component into the element the shell gave", async () => {
    const el = document.body.appendChild(document.createElement("div"));
    await act(async () => { mountRoute(el, Ticker); });
    expect(el.textContent).toBe("page");
    el.remove();
    await settle();
  });

  it("unmounts when its element leaves the page (the shell never says so)", async () => {
    const el = document.body.appendChild(document.createElement("div"));
    await act(async () => { mountRoute(el, Ticker); });
    expect(live).toBe(1);
    el.remove();
    await settle();
    expect(live).toBe(0);
    expect(mounted()).toBe(0);
  });

  it("draws again into the same element without keeping the old tree", async () => {
    const el = document.body.appendChild(document.createElement("div"));
    await act(async () => { mountRoute(el, Ticker); mountRoute(el, Ticker); });
    expect(live).toBe(1);
    el.remove();
    await settle();
    expect(live).toBe(0);
  });

  it("leaves nothing behind after 50 visits (the shell replaces the page each time)", async () => {
    const view = document.body.appendChild(document.createElement("main"));
    for (let i = 0; i < 50; i += 1) {
      const page = document.createElement("div");
      view.replaceChildren(page);
      await act(async () => { mountRoute(page, Ticker); });
    }
    await settle();
    expect(live).toBe(1);                // only the page on screen
    expect(mounted()).toBe(1);
    view.remove();
    await settle();
    expect(live).toBe(0);
    expect(mounted()).toBe(0);
  });
});
