/**
 * Which workbench shortcut, if any, a key press means.
 *
 * A pure function and one hard-coded action, not a command registry
 * (DATALAB-VIEW-001 design-doc/02 §11.1, Decision 7). The first shortcut system
 * needs exactly one behaviour — open the launcher — and a registry with dynamic
 * priorities, application contributions, user remapping and command metadata
 * would be a large amount of machinery answering a question nobody has asked.
 * A route table earns its place when a second or third shortcut exists.
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
}

export type ShortcutDecision = { kind: "ignore" } | { kind: "open-launcher" };

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
  if (event.key.toLowerCase() !== "k") return { kind: "ignore" };
  if (!isModKey(event, platform) || event.altKey) return { kind: "ignore" };

  // Mod+K is a chord, so an editable target is not a reason to ignore it on its
  // own — a user typing in a rename field still expects the launcher. What does
  // block it is another transient surface already owning the keyboard: the
  // object menu, a pending accept, or a dialog, including the launcher itself.
  if (context.launcherOpen || context.dialogOpen) return { kind: "ignore" };
  if (context.objectMenuOpen || context.acceptingPresentation) return { kind: "ignore" };

  return { kind: "open-launcher" };
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
