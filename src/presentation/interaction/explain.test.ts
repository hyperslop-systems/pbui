import { describe, expect, it } from "vitest";
import { available, hidden, unavailable } from "../actions";
import { definePresentation } from "../model";
import { explainResolution } from "./explain";

type Values = { file: { id: string } };
type Facts = { locked: boolean };
type Verb = { kind: string };

const p = definePresentation<Values, { name: string }, Facts, Verb>();

const presentation = p.create({
  id: "test.explain",
  types: [{ id: "file" }],
  knownScopes: ["global", "admin"],
  defaultActiveScopes: ["global"],
  revision: (facts) => (facts.locked ? "locked" : "open"),
  descriptors: { file: { label: (value) => value.id } },
  actions: [
    p.actions.exact("file", { id: "files.open", action: "presentation.open", scopes: ["global"], test: () => available(), metadata: { label: "Open" }, bind: () => ({ kind: "open" }) }),
    p.actions.exact("file", { id: "files.delete-rule", action: "files.delete", scopes: ["global"], test: ({ snapshot }) => (snapshot.product.locked ? unavailable("locked by policy", "policy-lock") : available()), metadata: { label: "Delete" }, bind: () => ({ kind: "delete" }) }),
    p.actions.exact("file", { id: "files.audit-rule", action: "files.audit", scopes: ["global"], test: () => hidden("policy"), metadata: { label: "Audit trail" }, bind: () => ({ kind: "audit" }) }),
    p.actions.exact("file", { id: "files.admin-purge", action: "files.purge", scopes: ["admin"], test: () => available(), metadata: { label: "Purge" }, bind: () => ({ kind: "purge" }) }),
  ],
});

const FILE = { type: "file", value: { id: "f1" } } as const;
const menuQuery = { subject: FILE, invocation: "menu" as const };

function resolve(locked: boolean) {
  const snapshot = presentation.snapshot({ facts: { locked } });
  return presentation.actions.resolve(menuQuery, snapshot);
}

describe("explainResolution", () => {
  it("public: exactly the menu's rows in its order, with availability and the product's reason", () => {
    const resolution = resolve(true);
    const explanation = explainResolution(menuQuery, resolution, "public");
    expect(explanation.rows.map((row) => [row.action, row.outcome, row.because ?? null])).toEqual(
      resolution.actions.map((action) => [action.action, action.status.kind, action.status.kind === "unavailable" ? action.status.because : null]),
    );
    expect(explanation.rows.map((r) => r.action)).toEqual(["files.delete", "presentation.open"]);
    expect(explanation.query).toBe(menuQuery);
    expect(explanation.disclosure).toBe("public");
  });

  it("public omits hidden candidates, rejected candidates, reason codes and trace entries entirely", () => {
    const text = JSON.stringify(explainResolution(menuQuery, resolve(true), "public"));
    expect(text).not.toContain("files.audit");
    expect(text).not.toContain("admin-purge");
    expect(text).not.toContain("reasonCode");
    expect(text).not.toContain("policy-lock");
    expect(text).not.toContain("\"trace\"");
    expect(text).not.toContain("\"others\"");
  });

  it("developer explains the same rows as the menu, each with its trace, and lists every other candidate with its fate", () => {
    const resolution = resolve(true);
    const explanation = explainResolution(menuQuery, resolution, "developer");
    expect(explanation.rows.map((r) => r.candidateId)).toEqual(resolution.actions.map((a) => a.candidateId));
    for (const row of explanation.rows) {
      expect(row.trace?.length).toBeGreaterThan(0);
      expect(row.trace?.every((entry) => entry.candidateId === row.candidateId)).toBe(true);
    }
    const fates = Object.fromEntries((explanation.others ?? []).map((c) => [c.contributionId, `${c.stage}:${c.result}`]));
    expect(fates["files.audit-rule"]).toBe("selected:hidden");
    expect(fates["files.admin-purge"]).toBe("scope:reject");
    expect(explanation.others?.every((c) => !explanation.rows.some((r) => r.candidateId === c.candidateId))).toBe(true);
  });

  it("developer carries the trace's reason codes; the delete row shows its policy code", () => {
    const explanation = explainResolution(menuQuery, resolve(true), "developer");
    const del = explanation.rows.find((r) => r.action === "files.delete");
    expect(JSON.stringify(del)).toContain("policy-lock");
  });

  it("explains the query it was given, not a synthetic one", () => {
    const primaryQuery = { subject: FILE, invocation: "primary" as const };
    const snapshot = presentation.snapshot({ facts: { locked: false } });
    const explanation = explainResolution(primaryQuery, presentation.actions.resolve(primaryQuery, snapshot), "public");
    expect(explanation.query.invocation).toBe("primary");
  });
});
