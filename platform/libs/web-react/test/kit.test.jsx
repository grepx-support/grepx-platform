/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// The React page pieces draw what the kit draws: compared with the same normaliser the browser parity run uses.
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { empty, icon, kpi, pageHead, pill, raw, tabs } from "/assets/kit/index.js";
import { canonicalise } from "./canon.mjs";
import { Empty, Icon, Kpi, PageHead, Pill, Tabs } from "../src/kit.jsx";
import { Markup } from "../src/markup.jsx";

const kitSide = (markup) => { const d = document.createElement("div"); d.innerHTML = String(markup); return canonicalise(d); };
async function reactSide(node) {
  const d = document.createElement("div");
  document.body.append(d);
  await act(async () => { createRoot(d).render(node); });
  const out = canonicalise(d);
  d.remove();
  return out;
}

describe("the kit's page pieces", () => {
  it("PageHead", async () => {
    expect(await reactSide(<PageHead icon="truck" area="#0891b2" title="Fleet" subtitle="Every vehicle" actions={<button className="btn">Go</button>} />))
      .toBe(kitSide(pageHead({ icon: "truck", area: "#0891b2", title: "Fleet", subtitle: "Every vehicle", actions: raw("<button class=\"btn\">Go</button>") })));
  });
  it("PageHead without subtitle or area", async () => {
    expect(await reactSide(<PageHead title="Files" />)).toBe(kitSide(pageHead({ title: "Files" })));
  });
  it("Tabs", async () => {
    const list = [{ id: "a", label: "A", href: "#/a", icon: "truck" }, { id: "b", label: "B", href: "#/b" }];
    expect(await reactSide(<Tabs list={list} current="b" />)).toBe(kitSide(tabs(list, "b")));
  });
  it("Empty and Pill", async () => {
    expect(await reactSide(<Empty icon="upload" title="No files" text="Drop some" />)).toBe(kitSide(empty({ icon: "upload", title: "No files", text: "Drop some" })));
    expect(await reactSide(<Pill tone="warn">3d left</Pill>)).toBe(kitSide(pill("3d left", "warn")));
  });
  it("Kpi", async () => {
    expect(await reactSide(<Kpi label="Vehicles" value={4} icon="truck" area="#fff" href="#/fleet" />)).toBe(kitSide(kpi({ label: "Vehicles", value: 4, icon: "truck", area: "#fff", href: "#/fleet" })));
  });
  it("Icon draws the kit's svg", async () => {
    expect(await reactSide(<Icon name="plus" size={15} />)).toBe(kitSide(icon("plus", { size: 15 })));
    expect(await reactSide(<Icon name="check" label="Done" />)).toBe(kitSide(icon("check", { label: "Done" })));
  });
});

describe("Markup never carries script or handlers", () => {
  it("drops script elements and on* attributes", async () => {
    const out = await reactSide(<Markup of={'<div onclick="steal()" title="x"><script>alert(1)</script><b>ok</b></div>'} />);
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).toContain("title=x");
    expect(out).toContain("\"ok\"");
  });
});
