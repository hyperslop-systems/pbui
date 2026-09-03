/**
 * Which workbench shortcut, if any, a key press means.
 *
 * A pure function over a two-row route table, not a command registry
 * (DATALAB-VIEW-001 design-doc/02 §11.1, Decision 7). The first shortcut system
 * needed exactly one behaviour — open the launcher — and this file said "a
 * route table earns its place when a second or third shortcut exists". The
 * second shortcut exists now (PBUI-REBALANCE-1: Mod+Shift+K opens the
 * rebalance dialog), so the promised table is here — still static, still
 * without priorities, contributions, remapping or metadata, which remain
 * machinery nobody has asked for.
 *
 * Being pure is what makes the awkward cases testable: an editable target, an
 * open object menu, a pending accept, and a second embedded workbench are all
 * arguments here rather than DOM states to reproduce.
 */

export interface ShortcutContext {
  /** The event target is an input, textarea, select or contenteditable. */
  targetIsEditable: boolean;
  /** The launcher modal is already open. */
  launcherOpen: boolean;
  /** Any transient surface — a dialog, the launcher — is open. */
  dialogOpen: boolean;
  /** PBUI's object menu is showing. */
  objectMenuOpen: boolean;
  /** A presentation is waiting for the user to pick a value. */
  acceptingPresentation: boolean;
  /**
   * A tile or workspace name is being edited inline.
   *
   * Blocks the shortcut, and the reason is data loss rather than tidiness. The
   * launcher cannot restore focus to an `InlineRename` — focus restoration
   * looks for `[data-ptype="tile"]`, which that component replaces while it is
   * open — and navigating to another workspace unmounts the input, discarding
   * unsaved text while `renamingId` stays pointing at a placement the user can
   * no longer see. Finish or abandon the rename first; both are one key away.
   */
  renamingView: boolean;
}

export type ShortcutDecision = { kind: "ignore" } | { kind: "open-launcher" } | { kind: "open-rebalance" } | { kind: "toggle-link-mode" };

/**
 * The chords. One modifier apart on the same key: Mod+K places something,
 * Mod+Shift+K fixes the placements. Both rows share the guard block below —
 * a transient surface that blocks one blocks the other, for the same reasons.
 */
const ROUTES: ReadonlyArray<{ key: string; shift: boolean; decision: Exclude<ShortcutDecision, { kind: "ignore" }> }> = [
  { key: "k", shift: false, decision: { kind: "open-launcher" } },
  { key: "k", shift: true, decision: { kind: "open-rebalance" } },
  // PBUI-LINK-1: connect-management mode, the patch bay behind the tiles.
  { key: "l", shift: true, decision: { kind: "toggle-link-mode" } },
];

/** The modifier that means "application shortcut": Meta on Apple, Control elsewhere. */
export function isModKey(
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
  platform: string,
): boolean {
  return /mac|iphone|ipad/i.test(platform) ? event.metaKey : event.ctrlKey;
}

export function routeWorkbenchKey(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  context: ShortcutContext,
  platform = "",
): ShortcutDecision {
  // Escape is deliberately absent. The topmost transient surface owns it, and
  // that is decided by the surface stack rather than here (§11.5).
  const route = ROUTES.find(
    (candidate) => candidate.key === event.key.toLowerCase() && candidate.shift === event.shiftKey,
  );
  if (!route) return { kind: "ignore" };
  if (!isModKey(event, platform) || event.altKey) return { kind: "ignore" };

  // These are chords, so an editable target is not a reason to ignore one on
  // its own — a user typing in a search box still expects the launcher. What
  // blocks a chord is another transient surface already owning the keyboard:
  // the object menu, a pending accept, a dialog (including the launcher and
  // the rebalance dialog themselves), or an inline rename, which is the one
  // that would lose work.
  if (context.launcherOpen || context.dialogOpen) return { kind: "ignore" };
  if (context.objectMenuOpen || context.acceptingPresentation) return { kind: "ignore" };
  if (context.renamingView) return { kind: "ignore" };

  return route.decision;
}

/**
 * Whether an event target consumes ordinary printable keys.
 *
 * Takes the two fields it reads rather than an `EventTarget`, so it stays
 * testable in the node environment the rest of this suite runs in. An
 * `instanceof HTMLElement` check would tie the whole module to a DOM for no
 * gain — a target either reports a tag name or it is not an element.
 */
export function isEditableTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "");
}
