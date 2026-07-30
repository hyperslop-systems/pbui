import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Dialog } from "./components/Dialog";
import {
  popEscapeSurface,
  pushEscapeSurface,
  resetEscapeSurfaces,
  topEscapeSurface,
  useEscapeSurface,
} from "./surfaces";

/**
 * Who owns Escape.
 *
 * The stack itself is four lines and hard to get wrong. What is easy to get
 * wrong is *registering twice for one surface*, which is a real bug this
 * library shipped for an hour: a consumer wrapped `Dialog` and registered its
 * own entry, that entry landed above the Dialog's own, and the Dialog decided
 * it was not topmost and stopped closing on Escape. Escape then did nothing at
 * all, which no unit test of the stack could see.
 */

// `globals` is off in this project's vitest config, so testing-library's
// automatic cleanup never registers and rendered trees would otherwise pile up
// in one document — which reads as "four dialogs" when two tests each made two.
afterEach(() => {
  cleanup();
  resetEscapeSurfaces();
});

const press = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

describe("the escape surface stack", () => {
  test("the last surface pushed owns Escape", () => {
    expect(topEscapeSurface()).toBeNull();
    pushEscapeSurface("a");
    pushEscapeSurface("b");
    expect(topEscapeSurface()).toBe("b");
    popEscapeSurface("b");
    expect(topEscapeSurface()).toBe("a");
  });

  test("pushing the same id twice seats it once", () => {
    pushEscapeSurface("a");
    pushEscapeSurface("a");
    popEscapeSurface("a");
    expect(topEscapeSurface()).toBeNull();
  });

  test("popping out of order leaves the rest intact", () => {
    pushEscapeSurface("a");
    pushEscapeSurface("b");
    popEscapeSurface("a");
    expect(topEscapeSurface()).toBe("b");
  });
});

describe("Dialog and Escape", () => {
  function Closable({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = useState(true);
    if (!open) return <p>closed</p>;
    return (
      <Dialog title="a dialog" onClose={() => setOpen(false)}>
        <button type="button">focusable</button>
        {children}
      </Dialog>
    );
  }

  test("a lone dialog closes on Escape", () => {
    render(<Closable />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    press();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /**
   * One surface, one registration — asserted, because the alternative shipped.
   *
   * A consumer wrapped `Dialog` and registered its own entry for the same
   * surface. Child effects run before parent effects, so the wrapper's entry
   * landed ABOVE the Dialog's, the Dialog decided it was not topmost, and
   * Escape closed nothing at all.
   *
   * The stack cannot detect this: a wrapper and the Dialog it renders are two
   * components, and nothing in an id says they are one surface. So the rule is
   * a constraint on callers — `Dialog` registers for itself, and a wrapper must
   * not repeat it — and this test is here to state the consequence rather than
   * to pretend it is handled.
   */
  test("a wrapper that registers for the same surface takes Escape from the dialog", () => {
    function DoubleRegistered() {
      useEscapeSurface(true, "wrapper");
      return <Closable />;
    }
    render(<DoubleRegistered />);
    press();
    expect(
      screen.queryByRole("dialog"),
      "double registration is a caller error: Dialog already registers for itself",
    ).not.toBeNull();
  });

  test("a dialog beneath another surface ignores Escape", () => {
    render(<Closable />);
    act(() => pushEscapeSurface("something-on-top"));
    press();
    // Still open: the key belonged to whatever opened above it.
    expect(screen.getByRole("dialog")).toBeTruthy();

    act(() => popEscapeSurface("something-on-top"));
    press();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /**
   * The realistic ordering: a surface that opens LATER wins.
   *
   * This is what actually happens in an application — a dialog is on screen and
   * then a menu, a second dialog or an expanded panel opens over it. Ordering by
   * registration is exactly right for that, because registration follows the
   * click that caused it.
   */
  test("a surface opened over a dialog takes Escape, and gives it back", () => {
    render(<Closable />);
    act(() => pushEscapeSurface("opened-later"));
    press();
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => popEscapeSurface("opened-later"));
    press();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /**
   * The limit, stated rather than discovered.
   *
   * Two dialogs mounted *in the same commit*, one inside the other's body,
   * register bottom-up — React runs child effects before parent effects — so
   * the OUTER one ends up on top and takes Escape, which is the reverse of what
   * the nesting looks like.
   *
   * Not fixed, because fixing it means ordering by DOM containment instead of
   * by registration, and that is a materially bigger mechanism than "one
   * question, four lines" is meant to be. It does not arise here: every surface
   * in the product is a sibling at the shell root, opened by a click, and the
   * test above covers that. If a nested pair ever becomes real, this test is
   * the specification to change.
   */
  test("simultaneously mounted nested dialogs order by mount, not by nesting", () => {
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      if (!outer) return <p>outer closed</p>;
      return (
        <Dialog title="outer" onClose={() => setOuter(false)}>
          <button type="button">outer control</button>
          {inner && (
            <Dialog title="inner" onClose={() => setInner(false)}>
              <button type="button">inner control</button>
            </Dialog>
          )}
        </Dialog>
      );
    }
    render(<Nested />);
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    press();
    // The outer one closes, taking the inner with it. Documented, not desired.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("outer closed")).toBeTruthy();
  });
});
