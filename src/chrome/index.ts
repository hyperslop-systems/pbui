/**
 * The window-chrome kit (PBUI-UNIFY-001): the shared tile frame, drag/dock
 * machinery, launcher shell, and keyboard routing that the family products
 * previously carried as private copies. Everything here is document-model
 * agnostic (DR-U3): components take callbacks and DOM ids, never a workbench
 * document, so both the protocol-document products and datalab's layout
 * store consume the same chrome.
 */
export { TileFrame, DropZoneOverlay } from "./TileFrame";
export type { TileFrameProps } from "./TileFrame";
export { useTileDrag, zoneFor, registeredTileCount, startTileCarry } from "./useTileDrag";
export type { DockZone, DragZone, TileCarryOptions, UseTileDragOptions } from "./useTileDrag";
export { LauncherShell, splitDirectionFor } from "./LauncherShell";
export type {
  LauncherShellGroup,
  LauncherShellProps,
  LauncherShellRow,
} from "./LauncherShell";
export {
  isEditableTarget,
  isModKey,
  routeWorkbenchKey,
} from "./shortcutRouting";
export type { ShortcutContext, ShortcutDecision } from "./shortcutRouting";
