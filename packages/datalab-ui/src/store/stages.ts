import type { StageDefinition } from "./navigation";
import { pinnedDefinitions } from "./seed";
import { WELCOME_STAGE_ID, WORK_STAGE_ID } from "./stageIds";

/**
 * Stage policy (DATADROP-8 DR-59, DATADROP-14 DR-94): who may see a stage,
 * and where to land when the current one is not for them.
 *
 * The stage DEFINITIONS themselves live in `seed.ts` (`pinnedDefinitions`),
 * compiled into a workbench document; the ids in `stageIds.ts`. This file
 * keeps the two rules that read a definition, so `Workbench`'s gate,
 * `StageBar` and the launcher all consult one function each.
 */
export {
  ACCOUNT_SPACE_ID,
  ACCOUNT_STAGE_ID,
  DEMO_SPACE_IDS,
  SIGNIN_SPACE_ID,
  SIGNIN_STAGE_ID,
  TEMPLATES_SPACE_ID,
  TOUR_SPACE_IDS,
  WELCOME_SPACE_ID,
  WELCOME_STAGE_ID,
  WORK_STAGE_ID,
} from "./stageIds";

/**
 * May this stage be seen by a caller in this authentication state? (DR-94)
 *
 * The one definition of the rule. Both the gate in `Workbench` and the switcher
 * in `StageBar` call it, which is the point: two copies of "which stages exist
 * for whom" is how you get a switcher offering a stage the gate immediately
 * moves you off, flickering once per load.
 *
 * A pure function over a stage and a boolean, so it is testable with literals
 * and has no opinion about where `authed` came from.
 */
export function stageIsVisible(stage: Pick<StageDefinition, "audience">, authed: boolean): boolean {
  switch (stage.audience) {
    case "anonymous":
      return !authed;
    case "authenticated":
      return authed;
    default:
      // Including `undefined`: a stage a user made says nothing and is visible
      // throughout. See the field's comment for why absent must mean "any".
      return true;
  }
}

/**
 * Where to land when the current stage is not one you may see.
 *
 * Signed in: the cockpit. Signed out: `welcome`, and **not** `sign in`. A
 * stranger who has just arrived has not refused to sign in, they have not been
 * asked; and on the way out, dumping someone on a sign-in wall the moment they
 * chose to leave is the product arguing with them.
 */
export function landingStageFor(authed: boolean): string {
  return authed ? WORK_STAGE_ID : WELCOME_STAGE_ID;
}

/** Was this workspace id defined in code by *this* build? */
export function isPinnedSpaceId(id: string): boolean {
  return pinnedDefinitions().workspaces.some((workspace) => workspace.id === id);
}
