/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// The shared Collection: find, chips with counts, pages of 100, ticks and the bulk bar, switches saved together in one call
// and flipped back when refused.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collection } from "../src/collection/Collection.jsx";
import { tableView } from "../src/collection/views.jsx";

const VIEW = tableView([{ head: "Id", cell: (x) => <b>{x.id}</b> }, { head: "Name", cell: (x) => x.name }]);
const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `I${String(i).padStart(3, "0")}`, name: i % 2 ? "odd" : "even", enabled: i % 3 !== 0 }));

describe("Collection", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("finds as you type, filters by chip with counts, shows 100 at a time", async () => {
    render(<Collection items={many(150)} view={VIEW} text={(x) => `${x.id} ${x.name}`} what="items" save={async () => {}}
      filters={[{ id: "odd", label: "Odd", test: (x) => x.name === "odd" }]} />);
    expect(screen.getAllByRole("row").length).toBe(101);                       // header + 100
    fireEvent.click(screen.getByText(/Show more \(50 left\)/));
    expect(screen.getAllByRole("row").length).toBe(151);
    expect(screen.getByText("Odd").textContent).toContain("75");
    fireEvent.click(screen.getByText("Odd"));
    expect(screen.getAllByRole("row").length).toBe(76);
    fireEvent.input(screen.getByLabelText("Find"), { target: { value: "I001" } });
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(screen.getAllByRole("row").length).toBe(2);
  });

  it("saves switches made within a moment in one call, and flips them back when refused", async () => {
    const save = vi.fn(async () => {});
    const items = many(4);
    render(<Collection items={items} view={VIEW} text={(x) => x.id} save={save} manage />);
    const [a, b] = screen.getAllByRole("switch");
    fireEvent.click(a); fireEvent.click(b);
    expect(save).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].map((e) => e.key)).toEqual(["I000", "I001"]);
    expect(save.mock.calls[0][0][0].body).toEqual({ name: "even", enabled: true });
    const failing = vi.fn(async () => { throw new Error("no"); });
    const fresh = many(4);
    const { unmount } = render(<Collection items={fresh} view={VIEW} text={(x) => x.id} save={failing} manage />);
    fireEvent.click(screen.getAllByRole("switch").at(-1));
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(fresh[3].enabled).toBe(false);                                     // I003 was off (3 % 3 = 0): back to off
    unmount();
  });

  it("ticks feed the bulk bar; a bulk action that is done clears the ticks", async () => {
    const run = vi.fn(async () => true);
    render(<Collection items={many(3)} view={VIEW} text={(x) => x.id} manage what="items" bulk={[{ id: "rm", label: "Remove", run }]} />);
    fireEvent.click(screen.getByLabelText("Select I001"));
    fireEvent.click(screen.getByLabelText("Select I002"));
    expect(screen.getByText("2 items ticked")).toBeTruthy();
    fireEvent.click(screen.getByText("Remove 2"));
    await act(async () => {});
    expect(run.mock.calls[0][0].map((x) => x.id)).toEqual(["I001", "I002"]);
    expect(screen.queryByText(/items ticked/)).toBeNull();
  });
});
