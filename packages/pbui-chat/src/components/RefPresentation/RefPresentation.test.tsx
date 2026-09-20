import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { chat } from "../../../demo/src/chat";
import { DemoChat, eagle } from "../../stories/DemoChat";
import { RefPresentation } from "./RefPresentation";

afterEach(() => { cleanup(); chat.store.reset(); });

test("default references use one ObjectChip and retain focus, type, badge and activation", () => {
  const run = vi.fn();
  render(<DemoChat><RefPresentation reference={eagle} testId="object" badge="product" activate={{ run, doc: "inspect" }} /></DemoChat>);
  const object = screen.getByTestId("object");
  expect(object.getAttribute("data-ptype")).toBe("product");
  expect(object.querySelectorAll('[data-part="chip"]')).toHaveLength(1);
  expect(object.textContent).toContain("1oz American Gold Eagle 2024");
  expect(object.textContent).toContain("product");
  fireEvent.mouseOver(object);
  expect(chat.store.getState().focus).toEqual(eagle);
  chat.store.setFocus(null);
  fireEvent.focus(object);
  expect(chat.store.getState().focus).toEqual(eagle);
  fireEvent.click(object);
  fireEvent.keyDown(object, { key: "Enter" });
  expect(run).toHaveBeenCalledTimes(2);
});

test.each([false, true])("custom bodies remain untouched (block=%s)", (block) => {
  render(<DemoChat><RefPresentation reference={eagle} block={block} testId="custom"><strong>custom content</strong></RefPresentation></DemoChat>);
  const custom = screen.getByTestId("custom");
  expect(custom.querySelector("strong")?.textContent).toBe("custom content");
  expect(custom.querySelector('[data-part="chip"]')).toBeNull();
  expect(custom.parentElement?.tagName).toBe(block ? "DIV" : "SPAN");
});

test("a default block reference remains a block presentation, not an inline chip", () => {
  render(<DemoChat><RefPresentation reference={eagle} block testId="block" /></DemoChat>);
  expect(screen.getByTestId("block").querySelector('[data-part="chip"]')).toBeNull();
  expect(screen.getByTestId("block").textContent).toContain("Gold Eagle");
});
