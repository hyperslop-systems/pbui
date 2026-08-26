import type { PresentationRegistry } from "../registry";
import type { PresentationValues } from "../types";
import { available, unavailable } from "./availability";
import type { ActionFamily } from "./types";

/**
 * The migration adapter (PBUI-ACTIONS-2 Amendment B; source guide §23).
 *
 * One family that routes the CURRENT descriptor `actions()` callbacks through
 * the kernel, so ObjectMenu can use the resolver before any product rewrites
 * an action. It exists for one migration window — PR 7 deletes it; it must
 * never become a permanent second action model.
 *
 * Contract:
 * - matches every concrete type exactly (`subject: "*"`); no inheritance, no
 *   cross-package override — exactly what descriptors do today;
 * - calls the descriptor callback once per resolution with the CURRENT
 *   environment, carried in the snapshot's product facts — which makes even
 *   unmigrated products strictly safer than today: revalidation re-runs the
 *   callback at perform time instead of delegating a render-time verb;
 * - maps `disabledBecause` to `unavailable`, preserves current row order
 *   through metadata `order` only, and namespaces action ids as
 *   `legacy.<type>.<action.id>` so legacy rows never compete with real rules.
 *
 * The P0 requirement that adapter ids be deliberate (not label/index) is what
 * makes `action.id` usable as the stable instance key here.
 */

export interface LegacyFacts<Environment> {
  environment: Environment;
}

export function legacyDescriptorFamily<
  Values extends PresentationValues,
  Environment,
  Verb,
>(options: {
  id: string;
  descriptors: PresentationRegistry<Values, Environment, Verb>;
  /** The scope the trivial legacy snapshot activates; default "global". */
  scope?: string;
}): ActionFamily<Values, LegacyFacts<Environment>, Verb> {
  return {
    kind: "family",
    id: options.id,
    subject: "*",
    match: "exact",
    scopes: [options.scope ?? "global"],
    expand: ({ subject, snapshot }) => {
      const rows = options.descriptors.actionsFor(subject, snapshot.product.environment);
      return rows.map((row, index) => ({
        key: row.id,
        action: `legacy.${subject.type}.${row.id}`,
        status: row.disabledBecause === undefined ? available() : unavailable(row.disabledBecause),
        metadata: {
          label: row.label,
          ...(row.description !== undefined ? { description: row.description } : {}),
          ...(row.group !== undefined ? { group: row.group } : {}),
          order: index,
          ...(row.danger !== undefined ? { danger: row.danger } : {}),
        },
        bind: () => row.verb,
      }));
    },
  };
}
