/**
 * The chrome kit (PBUI-UNIFY-001 Phase 2): zone geometry, drag registry
 * hygiene, the tile frame's callbacks, and the launcher shell's keyboard loop.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { LauncherShell } from "./LauncherShell";
import { routeWorkbenchKey, isEditableTarget, isModKey, type ShortcutContext } from "./shortcutRouting";
import { TileFrame } from "./TileFrame";
import { registeredTileCount, startTileCarry, useTileDrag, zoneFor } from "./useTileDrag";

afterEach(cleanup);

function box(width: number, height: number, left = 0): DOMRect {
  return {
    left,
    top: 0,
    right: left + width,
    bottom: height,
    width,
    height,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("zoneFor (DR-U4: the banded geometry)", () => {
  test("the centre of a large tile is generous", () => {
    // 1000x800: band = min(800*0.3, 110) = 110. A point 200px from every edge
    // is centre.
    expect(zoneFor(box(1000, 800), 500, 400)).toBe("center");
    expect(zoneFor(box(1000, 800), 200, 400)).toBe("center");
  });

  test("edges stay reachable on a small tile", () => {
    // 100x100: band = 30. 10px from the left edge is left.
    expect(zoneFor(box(100, 100), 10, 50)).toBe("left");
    expect(zoneFor(box(100, 100), 90, 50)).toBe("right");
    expect(zoneFor(box(100, 100), 50, 10)).toBe("top");
    expect(zoneFor(box(100, 100), 50, 90)).toBe("bottom");
    expect(zoneFor(box(100, 100), 50, 50)).toBe("center");
  });

  test("the band caps at 110px on huge tiles", () => {
    // 2000x2000: band = 110, so 150px in from the edge is already centre.
    expect(zoneFor(box(2000, 2000), 150, 1000)).toBe("center");
    expect(zoneFor(box(2000, 2000), 100, 1000)).toBe("left");
  });
});

describe("useTileDrag registry", () => {
  test("register and unregister keep the registry clean", () => {
    function Tile({ id }: { id: string }) {
      const drag = useTileDrag({ id, onSwap: () => {}, onDock: () => {} });
      return <section ref={drag.register} data-placement-id={id} />;
    }
    const before = registeredTileCount();
    const first = render(<Tile id="drag-test-a" />);
    render(<Tile id="drag-test-b" />);
    expect(registeredTileCount()).toBe(before + 2);
    first.unmount();
    expect(registeredTileCount()).toBe(before + 1);
    cleanup();
    expect(registeredTileCount()).toBe(before);
  });
});

/**
 * A drag that outlives its release is the failure this suite guards: the
 * pointer goes up outside the browser window, no `pointerup` arrives, and the
 * NEXT click lands on a still-armed drag and swaps two tiles the user never
 * touched. Only a real `pointerup` may commit.
 */
describe("useTileDrag lifecycle", () => {
  function DragTile({
    id,
    left,
    onSwap,
    onDock,
  }: {
    id: string;
    left: number;
    onSwap: (a: string, b: string) => void;
    onDock: (a: string, b: string, zone: string) => void;
  }) {
    const drag = useTileDrag({ id, onSwap, onDock });
    return (
      <section
        ref={(element) => {
          // jsdom has no layout; the hit test needs a rect to classify.
          if (element)
            element.getBoundingClientRect = () =>
              box(100, 100, left) as DOMRect;
          drag.register(element);
        }}
        data-placement-id={id}
      >
        <button type="button" data-testid={`grip-${id}`} onPointerDown={drag.onGripPointerDown} />
      </section>
    );
  }

  function setup() {
    const onSwap = vi.fn();
    const onDock = vi.fn();
    const view = render(
      <>
        <DragTile id="live-a" left={0} onSwap={onSwap} onDock={onDock} />
        <DragTile id="live-b" left={200} onSwap={onSwap} onDock={onDock} />
      </>,
    );
    return { onSwap, onDock, view };
  }

  /**
   * jsdom does not implement `PointerEvent`, so testing-library's
   * `fireEvent.pointerMove` degrades to a bare `Event` and silently drops
   * clientX/clientY — the hit test would then see `undefined` coordinates.
   * `MouseEvent` carries them and matches the `pointer*` type name fine.
   */
  function pointer(type: string, x = 250, y = 50) {
    fireEvent(window, new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  }

  /** Grab A's grip and hold the pointer over B's centre. */
  function dragAOverB() {
    fireEvent.pointerDown(screen.getByTestId("grip-live-a"), { pointerId: 1 });
    pointer("pointermove");
  }

  test("a release over the target's centre swaps", () => {
    const { onSwap } = setup();
    dragAOverB();
    expect(document.body.style.userSelect).toBe("none");
    pointer("pointerup");
    expect(onSwap).toHaveBeenCalledWith("live-a", "live-b");
    expect(document.body.style.userSelect).toBe("");
  });

  test("pointercancel abandons the drag, and a later pointerup cannot revive it", () => {
    const { onSwap, onDock } = setup();
    dragAOverB();
    pointer("pointercancel");
    expect(onSwap).not.toHaveBeenCalled();
    expect(document.body.style.userSelect).toBe("");
    pointer("pointerup");
    expect(onSwap).not.toHaveBeenCalled();
    expect(onDock).not.toHaveBeenCalled();
  });

  test("window blur ends a drag released outside the window", () => {
    const { onSwap } = setup();
    dragAOverB();
    fireEvent.blur(window);
    expect(onSwap).not.toHaveBeenCalled();
    expect(document.body.style.userSelect).toBe("");
  });

  test("unmounting mid-drag restores the selection override and commits nothing", () => {
    const { onSwap, view } = setup();
    dragAOverB();
    view.unmount();
    expect(document.body.style.userSelect).toBe("");
    pointer("pointerup");
    expect(onSwap).not.toHaveBeenCalled();
  });
});

/**
 * The Alt-held drop replaces the whole target tile (PBUI-REBALANCE-1). Alt is
 * live state: pressing it mid-hover reclassifies without a pointer move, and
 * releasing it falls back to the plain zone. Without an `onReplace` consumer
 * the modifier is inert.
 */
describe("useTileDrag Alt-replace", () => {
  function ReplaceTile({
    id,
    left,
    onSwap,
    onDock,
    onReplace,
  }: {
    id: string;
    left: number;
    onSwap: (a: string, b: string) => void;
    onDock: (a: string, b: string, zone: string) => void;
    onReplace?: (a: string, b: string) => void;
  }) {
    const drag = useTileDrag({ id, onSwap, onDock, ...(onReplace ? { onReplace } : {}) });
    return (
      <section
        ref={(element) => {
          if (element) element.getBoundingClientRect = () => box(100, 100, left) as DOMRect;
          drag.register(element);
        }}
        data-placement-id={id}
        data-zone={drag.zone ?? undefined}
        data-testid={`tile-${id}`}
      >
        <button type="button" data-testid={`grip-${id}`} onPointerDown={drag.onGripPointerDown} />
      </section>
    );
  }

  function setup(withReplace = true) {
    const onSwap = vi.fn();
    const onDock = vi.fn();
    const onReplace = vi.fn();
    render(
      <>
        <ReplaceTile id="alt-a" left={0} onSwap={onSwap} onDock={onDock} {...(withReplace ? { onReplace } : {})} />
        <ReplaceTile id="alt-b" left={200} onSwap={onSwap} onDock={onDock} {...(withReplace ? { onReplace } : {})} />
      </>,
    );
    return { onSwap, onDock, onReplace };
  }

  function pointer(type: string, options: { x?: number; y?: number; altKey?: boolean } = {}) {
    fireEvent(
      window,
      new MouseEvent(type, { clientX: options.x ?? 250, clientY: options.y ?? 50, altKey: options.altKey ?? false, bubbles: true }),
    );
  }

  test("Alt held during the move classifies the whole tile as replace and commits it", () => {
    const { onSwap, onReplace } = setup();
    fireEvent.pointerDown(screen.getByTestId("grip-alt-a"), { pointerId: 1 });
    // Near B's left edge — WOULD be a dock, but Alt covers the whole tile.
    pointer("pointermove", { x: 210, altKey: true });
    expect(screen.getByTestId("tile-alt-b").dataset.zone).toBe("replace");
    pointer("pointerup", { x: 210, altKey: true });
    expect(onReplace).toHaveBeenCalledWith("alt-a", "alt-b");
    expect(onSwap).not.toHaveBeenCalled();
  });

  test("pressing and releasing Alt mid-hover reclassifies without a pointer move", () => {
    const { onSwap, onReplace } = setup();
    fireEvent.pointerDown(screen.getByTestId("grip-alt-a"), { pointerId: 1 });
    pointer("pointermove"); // B's centre, no Alt
    expect(screen.getByTestId("tile-alt-b").dataset.zone).toBe("center");
    fireEvent.keyDown(window, { key: "Alt" });
    expect(screen.getByTestId("tile-alt-b").dataset.zone).toBe("replace");
    fireEvent.keyUp(window, { key: "Alt" });
    expect(screen.getByTestId("tile-alt-b").dataset.zone).toBe("center");
    pointer("pointerup");
    expect(onSwap).toHaveBeenCalledWith("alt-a", "alt-b");
    expect(onReplace).not.toHaveBeenCalled();
  });

  test("without an onReplace consumer, Alt is inert and the drop swaps", () => {
    const { onSwap, onReplace } = setup(false);
    fireEvent.pointerDown(screen.getByTestId("grip-alt-a"), { pointerId: 1 });
    pointer("pointermove", { altKey: true });
    expect(screen.getByTestId("tile-alt-b").dataset.zone).toBe("center");
    pointer("pointerup", { altKey: true });
    expect(onSwap).toHaveBeenCalledWith("alt-a", "alt-b");
    expect(onReplace).not.toHaveBeenCalled();
  });
});

/**
 * A carry is placement mode (PBUI-REBALANCE-1): a launcher choice aimed at
 * the tiles with a free pointer. Overlays classify exactly like a drag, the
 * next pointerdown commits (and never reaches the tile's content), Escape
 * and empty-space clicks cancel, Enter takes the caller's default.
 */
describe("startTileCarry (placement mode)", () => {
  function CarryTile({ id, left }: { id: string; left: number }) {
    const drag = useTileDrag({ id, onSwap: () => {}, onDock: () => {} });
    return (
      <section
        ref={(element) => {
          if (element) element.getBoundingClientRect = () => box(100, 100, left) as DOMRect;
          drag.register(element);
        }}
        data-zone={drag.zone ?? undefined}
        data-carrying={drag.carrying ? "true" : undefined}
        data-testid={`carry-${id}`}
      />
    );
  }

  function setup(options: Partial<import("./useTileDrag").TileCarryOptions> = {}) {
    const onDrop = vi.fn();
    const onCancel = vi.fn();
    const onDefault = vi.fn();
    render(
      <>
        <CarryTile id="carry-a" left={0} />
        <CarryTile id="carry-b" left={200} />
      </>,
    );
    let cancel!: () => void;
    act(() => {
      cancel = startTileCarry({ onDrop, onCancel, onDefault, ...options });
    });
    return { onDrop, onCancel, onDefault, cancel: () => act(cancel) };
  }

  function pointer(type: string, options: { x?: number; y?: number; altKey?: boolean } = {}) {
    fireEvent(
      window,
      new MouseEvent(type, { clientX: options.x ?? 250, clientY: options.y ?? 50, altKey: options.altKey ?? false, bubbles: true }),
    );
  }

  afterEach(() => {
    // No carry may outlive its test.
    fireEvent.keyDown(window, { key: "Escape" });
  });

  test("tiles see the carry: overlays classify and the click commits the drop", () => {
    const { onDrop, onCancel } = setup();
    expect(screen.getByTestId("carry-carry-a").dataset.carrying).toBe("true");
    pointer("pointermove", { x: 210 }); // near B's left edge
    expect(screen.getByTestId("carry-carry-b").dataset.zone).toBe("left");
    pointer("pointerdown", { x: 210 });
    expect(onDrop).toHaveBeenCalledWith("carry-b", "left");
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByTestId("carry-carry-a").dataset.carrying).toBeUndefined();
  });

  test("Alt classifies the whole tile as replace, live from the keyboard", () => {
    const { onDrop } = setup();
    pointer("pointermove", { x: 210 });
    fireEvent.keyDown(window, { key: "Alt" });
    expect(screen.getByTestId("carry-carry-b").dataset.zone).toBe("replace");
    fireEvent.keyUp(window, { key: "Alt" });
    expect(screen.getByTestId("carry-carry-b").dataset.zone).toBe("left");
    pointer("pointerdown", { x: 210, altKey: true });
    expect(onDrop).toHaveBeenCalledWith("carry-b", "replace");
  });

  test("Escape cancels; a click on empty space cancels; Enter takes the default", () => {
    const first = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(first.onCancel).toHaveBeenCalledTimes(1);
    expect(first.onDrop).not.toHaveBeenCalled();

    const second = setup();
    pointer("pointerdown", { x: 900 }); // outside every tile
    expect(second.onCancel).toHaveBeenCalledTimes(1);

    const third = setup();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(third.onDefault).toHaveBeenCalledTimes(1);
    expect(third.onDrop).not.toHaveBeenCalled();
  });

  test("the placement Enter never reaches a focused application control (PR #19)", () => {
    const { onDefault } = setup();
    const control = document.createElement("button");
    document.body.append(control);
    const appHandler = vi.fn();
    control.addEventListener("keydown", appHandler);
    // A real key press targets the focused element and bubbles; the carry's
    // capture-phase window listener must consume it before the control sees it.
    fireEvent.keyDown(control, { key: "Enter" });
    expect(onDefault).toHaveBeenCalledTimes(1);
    expect(appHandler).not.toHaveBeenCalled();
    control.remove();
  });

  test("a second carry cancels the first; cancel is idempotent", () => {
    const first = setup();
    const second = setup();
    expect(first.onCancel).toHaveBeenCalledTimes(1);
    second.cancel();
    second.cancel();
    expect(second.onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("TileFrame", () => {
  test("wires the split and close callbacks and respects canClose", () => {
    const onSplit = vi.fn();
    const onClose = vi.fn();
    render(
      <TileFrame
        placementId="p1"
        tone="var(--pbui-tone-neutral)"
        title="lean source"
        canClose={false}
        onSplit={onSplit}
        onClose={onClose}
      >
        body
      </TileFrame>,
    );
    fireEvent.click(screen.getByRole("button", { name: "split side by side" }));
    expect(onSplit).toHaveBeenCalledWith("row");
    fireEvent.click(screen.getByRole("button", { name: "split top and bottom" }));
    expect(onSplit).toHaveBeenCalledWith("col");
    const close = screen.getByRole("button", { name: "close this pane" }) as HTMLButtonElement;
    expect(close.disabled).toBe(true);
    fireEvent.click(close);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("renders the drop overlay naming the outcome", () => {
    render(
      <TileFrame
        placementId="p2"
        tone="t"
        title="goals"
        canClose
        onSplit={() => {}}
        onClose={() => {}}
        dropZone="left"
      >
        body
      </TileFrame>,
    );
    expect(screen.getByText(/split-dock here/).closest('[data-part="drop-zone"]')).toBeTruthy();
  });
});

describe("LauncherShell", () => {
  function Harness({ onChoose }: { onChoose(id: string): void }) {
    const [query, setQuery] = useState("");
    return (
      <LauncherShell
        title="Open a view"
        groups={[
          { label: "OPEN VIEWS", rows: [{ id: "view:a", title: "goals" }] },
          {
            label: "NEW VIEW",
            rows: [
              { id: "app:b", title: "script" },
              { id: "app:c", title: "step", disabled: true },
            ],
          },
        ]}
        query={query}
        onQueryChange={setQuery}
        onChoose={onChoose}
        onClose={() => {}}
        enterVerb={(id) => (id?.startsWith("view:") ? "go to" : "open")}
      />
    );
  }

  test("wraps with the arrows, retains the highlight, Enter chooses", () => {
    const onChoose = vi.fn();
    render(<Harness onChoose={onChoose} />);
    const input = screen.getByRole("combobox");
    // First row is active by default.
    expect(input.getAttribute("aria-activedescendant")).toBe("view:a");
    fireEvent.keyDown(input, { key: "ArrowUp" }); // wraps to the last row
    expect(input.getAttribute("aria-activedescendant")).toBe("app:c");
    fireEvent.keyDown(input, { key: "Enter" }); // disabled row: no choice
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith("app:b");
  });

  test("names the enter verb after the ACTIVE row", () => {
    render(<Harness onChoose={() => {}} />);
    expect(screen.getByText(/Enter go to/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.getByText(/Enter open/)).toBeTruthy();
  });
});

describe("shortcut routing (moved verbatim from datalab-ui)", () => {
  const quiet: ShortcutContext = {
    targetIsEditable: false,
    launcherOpen: false,
    dialogOpen: false,
    objectMenuOpen: false,
    acceptingPresentation: false,
    renamingView: false,
  };
  const key = (overrides: Partial<KeyboardEvent> = {}) =>
    ({ key: "k", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides });

  test("Mod is Meta on Apple platforms and Control elsewhere", () => {
    expect(isModKey({ metaKey: true, ctrlKey: false }, "MacIntel")).toBe(true);
    expect(isModKey({ metaKey: false, ctrlKey: true }, "MacIntel")).toBe(false);
    expect(isModKey({ metaKey: false, ctrlKey: true }, "Linux x86_64")).toBe(true);
  });

  test("Mod+K opens; transient surfaces block; editable targets do not", () => {
    expect(routeWorkbenchKey(key({ ctrlKey: true }), quiet, "Linux")).toEqual({
      kind: "open-launcher",
    });
    for (const overrides of [
      { launcherOpen: true },
      { dialogOpen: true },
      { objectMenuOpen: true },
      { acceptingPresentation: true },
      { renamingView: true },
    ]) {
      expect(routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, ...overrides }, "Linux")).toEqual(
        { kind: "ignore" },
      );
    }
    expect(
      routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, targetIsEditable: true }, "Linux"),
    ).toEqual({ kind: "open-launcher" });
  });

  test("editable target detection", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  test("Shift discriminates the two chords on the same key", () => {
    expect(routeWorkbenchKey(key({ ctrlKey: true, shiftKey: true }), quiet, "Linux")).toEqual({
      kind: "open-rebalance",
    });
    expect(routeWorkbenchKey(key({ metaKey: true, shiftKey: true }), quiet, "MacIntel")).toEqual({
      kind: "open-rebalance",
    });
    // Without Mod, Shift+K is just typing a capital K.
    expect(routeWorkbenchKey(key({ shiftKey: true }), quiet, "Linux")).toEqual({ kind: "ignore" });
  });

  test("the rebalance chord shares the launcher's guard block", () => {
    for (const overrides of [
      { launcherOpen: true },
      { dialogOpen: true },
      { objectMenuOpen: true },
      { acceptingPresentation: true },
      { renamingView: true },
    ] satisfies Partial<ShortcutContext>[]) {
      expect(
        routeWorkbenchKey(key({ ctrlKey: true, shiftKey: true }), { ...quiet, ...overrides }, "Linux"),
      ).toEqual({ kind: "ignore" });
    }
    expect(
      routeWorkbenchKey(key({ ctrlKey: true, shiftKey: true }), { ...quiet, targetIsEditable: true }, "Linux"),
    ).toEqual({ kind: "open-rebalance" });
  });
});
