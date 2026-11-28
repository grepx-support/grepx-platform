/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// F-7: the loading pattern every React page uses draws its four states the way the legacy pages did: the skeleton while loading, the shell's
// "Couldn't load this page" card (with retry and trace) on a failure, and the data once it is here.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Loaded, useLoad } from "../src/hooks.jsx";

function Page({ fn }) {
  const load = useLoad(fn, []);
  return <Loaded state={load}>{(d) => <p>got {d.name}</p>}</Loaded>;
}

describe("Loaded + useLoad", () => {
  it("shows the skeleton, then the data", async () => {
    let done;
    const fn = vi.fn(() => new Promise((ok) => { done = ok; }));
    const { container } = render(<Page fn={fn} />);
    expect(container.querySelector(".kit-skeleton")).toBeTruthy();
    await act(async () => {});                                   // the load starts in a microtask after the first draw
    await act(async () => { done({ name: "Ann" }); });
    expect(screen.getByText("got Ann")).toBeTruthy();
    expect(container.querySelector(".kit-skeleton")).toBeNull();
  });

  it("says what went wrong and can try again", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Nobody answered"), { status: 503, trace: "abc123" }))
      .mockResolvedValueOnce({ name: "Bo" });
    render(<Page fn={fn} />);
    await act(async () => {});
    expect(screen.getByText("Couldn't load this page")).toBeTruthy();
    expect(screen.getByText(/trace abc123/)).toBeTruthy();
    expect(screen.getByText(/A part of the system did not answer/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(screen.getByText("got Bo")).toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("shows a client error's own words, not the generic hint", async () => {
    render(<Page fn={() => Promise.reject(Object.assign(new Error("You may not see this"), { status: 403 }))} />);
    await act(async () => {});
    expect(screen.getByText("You may not see this")).toBeTruthy();
    expect(screen.queryByText(/A part of the system did not answer/)).toBeNull();
  });

  it("drops a late answer to an old request", async () => {
    let first, second;
    const fn = vi.fn().mockImplementationOnce(() => new Promise((ok) => { first = ok; })).mockImplementationOnce(() => new Promise((ok) => { second = ok; }));
    function Twice() {
      const load = useLoad(fn, []);
      return <><button onClick={load.reload}>again</button><Loaded state={load}>{(d) => <p>got {d.name}</p>}</Loaded></>;
    }
    render(<Twice />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "again" })); });
    await act(async () => { second({ name: "new" }); });
    await act(async () => { first({ name: "old" }); });
    expect(screen.getByText("got new")).toBeTruthy();
  });
});
