/**
 * The code-defined stage and workspace ids (DATADROP-8 DR-59).
 *
 * Fixed rather than minted, which is what lets a stored layout be matched
 * against this build's definitions on every load. In their own module so the
 * navigation slice, the seed compiler and the stage policy can all name them
 * without importing each other.
 */
export const SIGNIN_STAGE_ID = "stage-signin";
export const WELCOME_STAGE_ID = "stage-welcome";
export const ACCOUNT_STAGE_ID = "stage-account";
export const WORK_STAGE_ID = "stage-work";

/** The sign-in stage's single workspace. */
export const SIGNIN_SPACE_ID = "ws-signin";
/** Where a signed-out visitor lands (DATADROP-14): the welcome stage's first workspace. */
export const WELCOME_SPACE_ID = "ws-welcome";
/** The welcome stage's four tutorial workspaces. */
export const TOUR_SPACE_IDS = ["ws-tour-1", "ws-tour-2", "ws-tour-3", "ws-tour-4"] as const;
/** Finished product demonstrations, after the four teaching workspaces. */
export const DEMO_SPACE_IDS = ["ws-demo-5", "ws-demo-6", "ws-demo-7"] as const;
/** The account stage's workspaces. */
export const ACCOUNT_SPACE_ID = "ws-account";
/** The templates workspace, which the stage menu's "templates …" opens. */
export const TEMPLATES_SPACE_ID = "ws-templates";

export const PINNED_STAGE_IDS: ReadonlySet<string> = new Set([
  SIGNIN_STAGE_ID,
  WELCOME_STAGE_ID,
  ACCOUNT_STAGE_ID,
  WORK_STAGE_ID,
]);
