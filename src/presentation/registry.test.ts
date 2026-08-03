import { describe, expect, test } from "vitest";
import { createPresentationRegistry } from "./registry";

interface Values {
  person: { id: string; name: string };
  project: { id: string; title: string };
}

interface Environment {
  currentUserId: string;
}

type Verb = { type: "select"; id: string };

const registry = createPresentationRegistry<Values, Environment, Verb>({
  person: {
    label: (person) => person.name,
    describe: (person) => ({ kind: "person", ...person }),
    tone: "accent",
    actions: (person, environment) => [
      {
        id: "select",
        label: "Select person",
        verb: { type: "select", id: person.id },
        // Under the old API this was a bare `disabled` with no explanation —
        // an action greyed out for no stated reason, which the merged field
        // no longer permits.
        disabledBecause:
          person.id === environment.currentUserId ? "that is you" : undefined,
      },
    ],
  },
  project: {
    label: (project) => project.title,
  },
});

describe("createPresentationRegistry", () => {
  test("resolves labels, descriptions, tones, and serializable verbs", () => {
    const reference = { type: "person", value: { id: "person-2", name: "Ada" } } as const;
    const environment = { currentUserId: "person-1" };

    expect(registry.labelFor(reference, environment)).toBe("Ada");
    expect(registry.describeFor(reference, environment)).toEqual({
      kind: "person",
      id: "person-2",
      name: "Ada",
    });
    expect(registry.toneFor(reference)).toBe("accent");
    expect(registry.actionsFor(reference, environment)).toEqual([
      {
        id: "select",
        label: "Select person",
        verb: { type: "select", id: "person-2" },
        // `person-2` is not the current user, so the action is available.
        // Under the old API this asserted `disabled: false` — a field that had
        // to be present and false. Absence is now how "available" is spelled,
        // which is the same fact with one fewer way to write it wrong.
        disabledBecause: undefined,
      },
    ]);
  });

  test("provides descriptor defaults without a global fallback registry", () => {
    const reference = {
      type: "project",
      value: { id: "project-1", title: "Compiler" },
    } as const;
    const environment = { currentUserId: "person-1" };

    expect(registry.has("project")).toBe(true);
    expect(registry.has("missing")).toBe(false);
    expect(registry.describeFor(reference, environment)).toEqual({
      presentationType: "project",
      value: reference.value,
    });
    expect(registry.actionsFor(reference, environment)).toEqual([]);
    expect(registry.toneFor(reference)).toBe("neutral");
  });

  test("falls back safely for presentation types without descriptors", () => {
    const partial = createPresentationRegistry<Values, Environment, Verb>({
      person: {
        label: (person) => person.name,
      },
    });
    const reference = {
      type: "project",
      value: { id: "project-1", title: "Compiler" },
    } as const;
    const environment = { currentUserId: "person-1" };

    expect(partial.descriptorFor("project")).toBeNull();
    expect(partial.labelFor(reference, environment)).toBe(
      '{"id":"project-1","title":"Compiler"}',
    );
    expect(partial.actionsFor(reference, environment)).toEqual([]);
  });
});
