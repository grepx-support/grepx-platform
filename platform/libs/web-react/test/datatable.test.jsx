/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// DataTable: sort, filter, pages and rows that open - the kit table's behaviour.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DataTable } from "../src/DataTable.jsx";

const rows = Array.from({ length: 30 }, (_, i) => ({ id: i, name: i % 2 ? `Beta ${i}` : `Alpha ${i}`, n: 30 - i }));
const columns = [{ key: "name", label: "Name" }, { key: "n", label: "N", align: "end" }];

describe("DataTable", () => {
  it("shows a page of rows and the pager when there are more than 25", () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getAllByRole("row")).toHaveLength(31);          // header + 30 (page size 50)
    expect(screen.getByText("1-30 of 30")).toBeTruthy();
  });
  it("sorts by a header and flips on a second click", async () => {
    render(<DataTable columns={columns} rows={rows} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "N" })); });
    const first = () => within(screen.getAllByRole("row")[1]).getAllByRole("cell")[1].textContent;
    expect(first()).toBe("1");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "N" })); });
    expect(first()).toBe("30");
  });
  it("filters by any column", async () => {
    render(<DataTable columns={columns} rows={rows} />);
    await act(async () => { fireEvent.change(screen.getByLabelText("Filter rows"), { target: { value: "beta 3" } }); });
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
  it("opens a row on click but not when a link inside it is clicked", async () => {
    const onRow = vi.fn();
    render(<DataTable columns={[{ key: "name", label: "Name", render: (r) => <a href="#x">{r.name}</a> }]} rows={rows.slice(0, 2)} onRow={onRow} />);
    await act(async () => { fireEvent.click(screen.getAllByRole("row")[1].querySelector("td")); });
    expect(onRow).toHaveBeenCalledOnce();
    await act(async () => { fireEvent.click(screen.getAllByRole("link")[0]); });
    expect(onRow).toHaveBeenCalledOnce();
  });
  it("says so when there is nothing", () => {
    render(<DataTable columns={columns} rows={[]} empty="None ✓" />);
    expect(screen.getByText("None ✓")).toBeTruthy();
  });
});
