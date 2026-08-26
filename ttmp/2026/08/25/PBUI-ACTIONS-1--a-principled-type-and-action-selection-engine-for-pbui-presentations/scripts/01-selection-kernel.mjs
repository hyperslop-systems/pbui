#!/usr/bin/env node
/**
 * Executable design sketch for PBUI-ACTIONS-1.
 *
 * It is deliberately dependency-free and is not production code. It tests four
 * semantic claims from the report:
 *   1. subtype rules contribute actions to subtype objects;
 *   2. the most-specific declaration overrides the same action identity;
 *   3. modes/history affect explained availability, not type identity;
 *   4. execution advice wraps the already-resolved serializable verb.
 */

const typeParents = new Map([
  ["object", []],
  ["document", ["object"]],
  ["file", ["document"]],
  ["image-file", ["file"]],
]);

function distance(actual, declared) {
  if (actual === declared) return 0;
  const seen = new Set([actual]);
  let frontier = [[actual, 0]];
  while (frontier.length) {
    const [current, depth] = frontier.shift();
    for (const parent of typeParents.get(current) ?? []) {
      if (parent === declared) return depth + 1;
      if (!seen.has(parent)) {
        seen.add(parent);
        frontier.push([parent, depth + 1]);
      }
    }
  }
  return Number.POSITIVE_INFINITY;
}

function projectHistory(events) {
  return events.reduce(
    (state, event) => {
      if (event.kind === "selection.changed") state.selectedIds = new Set(event.ids);
      if (event.kind === "action.succeeded") state.lastSuccessfulAction = event.actionId;
      if (event.kind === "review.entered") state.modes.add("review");
      if (event.kind === "review.left") state.modes.delete("review");
      return state;
    },
    { selectedIds: new Set(), lastSuccessfulAction: null, modes: new Set() },
  );
}

const rules = [
  {
    id: "document.open",
    actionId: "open",
    from: "document",
    scopes: ["global"],
    label: "Open document",
    availability: () => ({ kind: "available" }),
    bind: (ref) => ({ kind: "document.open", id: ref.value.id }),
  },
  {
    id: "file.open",
    actionId: "open",
    from: "file",
    scopes: ["global"],
    label: "Open file",
    availability: () => ({ kind: "available" }),
    bind: (ref) => ({ kind: "file.open", id: ref.value.id }),
  },
  {
    id: "file.delete",
    actionId: "delete",
    from: "file",
    scopes: ["editing"],
    label: "Delete file",
    availability: ({ ref, context }) => {
      if (context.modes.has("review")) {
        return { kind: "unavailable", because: "review mode is read-only" };
      }
      if (context.lastSuccessfulAction === "delete" && !context.selectedIds.has(ref.value.id)) {
        return { kind: "unavailable", because: "select another file before deleting again" };
      }
      return { kind: "available" };
    },
    bind: (ref) => ({ kind: "file.delete", id: ref.value.id }),
  },
  {
    id: "image.annotate",
    actionId: "annotate",
    from: "image-file",
    scopes: ["editing"],
    label: "Annotate image",
    availability: ({ context }) =>
      context.modes.has("review")
        ? { kind: "available" }
        : { kind: "unavailable", because: "enter review mode to annotate" },
    bind: (ref) => ({ kind: "image.annotate", id: ref.value.id }),
  },
];

function resolveActions(ref, context, activeScopes) {
  const trace = [];
  const candidates = [];
  for (const rule of rules) {
    const d = distance(ref.type, rule.from);
    const scope = rule.scopes.find((item) => activeScopes.includes(item));
    if (!Number.isFinite(d) || !scope) {
      trace.push({ rule: rule.id, result: "rejected", because: !Number.isFinite(d) ? "type" : "scope" });
      continue;
    }
    const availability = rule.availability({ ref, context });
    candidates.push({ rule, distance: d, scope, availability });
    trace.push({ rule: rule.id, result: availability.kind, distance: d, scope, because: availability.because });
  }

  const byAction = Map.groupBy(candidates, (candidate) => candidate.rule.actionId);
  const actions = [];
  const ambiguities = [];
  for (const [actionId, group] of byAction) {
    const bestDistance = Math.min(...group.map((candidate) => candidate.distance));
    const maxima = group.filter((candidate) => candidate.distance === bestDistance);
    if (maxima.length !== 1) {
      ambiguities.push({ actionId, rules: maxima.map((candidate) => candidate.rule.id) });
      continue;
    }
    const winner = maxima[0];
    actions.push({
      id: actionId,
      label: winner.rule.label,
      status: winner.availability,
      verb: winner.rule.bind(ref),
      selectedRule: winner.rule.id,
    });
  }
  return { actions, ambiguities, trace };
}

function composeExecution(base, advice) {
  const matching = advice.filter((item) => item.matches);
  return matching
    .filter((item) => item.kind === "around")
    .reduceRight((next, item) => () => item.run(next), () => {
      for (const item of matching.filter((candidate) => candidate.kind === "before")) item.run();
      const result = base();
      for (const item of matching.filter((candidate) => candidate.kind === "after").reverse()) item.run(result);
      return result;
    });
}

const ref = { type: "image-file", value: { id: "img-7", name: "diagram.png" } };
const history = [
  { kind: "action.succeeded", actionId: "delete" },
  { kind: "review.entered" },
];
const context = projectHistory(history);
const result = resolveActions(ref, context, ["global", "editing"]);

console.log("SELECTION");
console.log(JSON.stringify(result, null, 2));

const executionLog = [];
const verb = result.actions.find((action) => action.id === "open").verb;
const execute = composeExecution(
  () => {
    executionLog.push(["handler", verb.kind]);
    return { changed: true };
  },
  [
    { kind: "before", matches: true, run: () => executionLog.push(["before", "audit"] ) },
    {
      kind: "around",
      matches: verb.kind.startsWith("file."),
      run: (proceed) => {
        executionLog.push(["around-enter", "authorization"]);
        const result = proceed();
        executionLog.push(["around-exit", result.changed]);
        return result;
      },
    },
    { kind: "after", matches: true, run: (result) => executionLog.push(["after", result.changed]) },
  ],
);

console.log("\nEXECUTION");
console.log(JSON.stringify({ verb, result: execute(), executionLog }, null, 2));

// Two independently contributed rules for the same action and same source type
// have no principled winner. Production registration should reject this shape;
// it must not silently make array/import order semantic.
const conflicting = [
  { id: "plugin-a.inspect", actionId: "inspect", from: "file" },
  { id: "plugin-b.inspect", actionId: "inspect", from: "file" },
];
const registrationAmbiguities = [...Map.groupBy(
  conflicting,
  (rule) => `${rule.actionId}@${rule.from}`,
)].filter(([, group]) => group.length > 1).map(([key, group]) => ({
  key,
  rules: group.map((rule) => rule.id),
}));
console.log("\nREGISTRATION DIAGNOSTIC");
console.log(JSON.stringify({ registrationAmbiguities }, null, 2));

// Fail loudly if the sketch ceases to demonstrate its intended semantics.
const open = result.actions.find((action) => action.id === "open");
const deletion = result.actions.find((action) => action.id === "delete");
const annotation = result.actions.find((action) => action.id === "annotate");
if (open.selectedRule !== "file.open") throw new Error("subtype specificity failed");
if (deletion.status.kind !== "unavailable") throw new Error("mode availability failed");
if (annotation.status.kind !== "available") throw new Error("mode activation failed");
if (result.ambiguities.length !== 0) throw new Error("unexpected runtime ambiguity");
if (registrationAmbiguities.length !== 1) throw new Error("registration ambiguity was not diagnosed");
