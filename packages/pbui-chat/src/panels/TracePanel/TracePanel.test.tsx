import { cleanup, render, screen } from "@testing-library/react";
import type { TimelineEntity } from "@go-go-golems/chat-provider";
import { afterEach, expect, test } from "vitest";
import { chat } from "../../../demo/src/chat";
import { DemoChat, eagle } from "../../stories/DemoChat";
import { TracePanel } from "./TracePanel";

const entries: TimelineEntity[] = [
  { id: "one", kind: "trace_entry", createdAt: 1, props: { seq: 1, actor: "human", verb: { kind: "inspect" }, target: eagle, outcome: "performed", at: "2026-09-06T12:00:00Z" } },
  { id: "two", kind: "trace_entry", createdAt: 2, props: { seq: 2, actor: "agent", verb: { kind: "close" }, outcome: "rejected: keep the last workspace", at: "2026-09-06T12:00:01Z" } },
];
afterEach(() => { cleanup(); chat.store.reset(); });

test("a targetless rejection retains a target cell and its full explanation", () => {
  const { container } = render(<DemoChat entities={entries}><TracePanel /></DemoChat>);
  const targets = container.querySelectorAll('[data-part="trace-target"]');
  expect(targets).toHaveLength(2);
  expect(targets[0]?.textContent).toBe("—");
  expect(targets[1]?.textContent).toContain("Gold Eagle");
  expect(screen.getByTitle("no target")).toBeTruthy();
  expect(screen.getByTitle("rejected: keep the last workspace").textContent).toContain("keep the last workspace");
});

test("layout changes preserve oldest-first ordering and limits", () => {
  const { container } = render(<DemoChat entities={entries}><TracePanel order="oldest" limit={1} /></DemoChat>);
  expect(container.querySelectorAll('[data-part="trace"] li')).toHaveLength(1);
  expect(screen.getByLabelText("verb trace").textContent).toContain("#1");
  expect(screen.getByLabelText("verb trace").textContent).not.toContain("#2");
});
