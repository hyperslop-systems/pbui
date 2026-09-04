import { useDispatch, useSelector } from "react-redux";
import {
  useCurrentStageId,
  useCurrentWorkspaceId,
  useDatalabWorkbench,
  useWorkspacesOfStage,
} from "../../../appkit/DatalabWorkbenchContext";
import { Presentation, usePbui } from "../../../pbui";
import type { RootState } from "../../../store";
import { navigationActions } from "../../../store/navigation";
import { Button, InlineRename, SectionLabel, Stack, Text, Toolbar } from "@hyperslop-systems/pbui";

/**
 * The workspace strip.
 *
 * Workspaces are named tile arrangements over ONE world. Switching is a state
 * change, not a remount of the data: the documents, the snapshots and the
 * cached tables are the same objects, which is why an accept started in one
 * workspace can be satisfied in another.
 *
 * **Scoped to the current stage** since DATADROP-8, which is why this is not
 * the workbench shell's own `WorkspaceStrip` (design §11.2): the generic strip
 * lists the whole document, and Datalab's stages are exactly the layer that
 * says which of those a user should see here. The workspaces come from the
 * core's document; which stage each belongs to, and whether it is pinned,
 * from navigation metadata.
 */
export function WorkspaceStrip() {
  const dispatch = useDispatch();
  const pbui = usePbui();
  const workbench = useDatalabWorkbench();
  const stageId = useCurrentStageId();
  const spaces = useWorkspacesOfStage(stageId);
  const current = useCurrentWorkspaceId();
  const meta = useSelector((s: RootState) => s.navigation.workspace);
  const renaming = useSelector((s: RootState) => s.navigation.renamingId);

  return (
    <Toolbar tight>
      <SectionLabel>Workspaces</SectionLabel>
      <Stack direction="row" gap={2} wrap align="center">
        {spaces.map((space) => {
          const pinned = meta[space.id]?.pinned === true;
          // A pinned space cannot be renamed: the name comes from code and
          // would be overwritten on the next load, so offering the edit would
          // be a lie (DR-29).
          return renaming === space.id && !pinned ? (
            <InlineRename
              key={space.id}
              initial={space.name}
              accessibleName="workspace name"
              fallback={space.name}
              // Through `perform`, not `dispatch`, so the rename appears in the
              // trace as a verb like every other user decision.
              onCommit={(name) =>
                pbui.perform({ kind: "renameWorkspace", spaceId: space.id, name })
              }
              onCancel={() => dispatch(navigationActions.beginRename(null))}
            />
          ) : (
            <Presentation
              key={space.id}
              // A WorkspaceRef, not a bare id: the descriptor has to know
              // whether this is the last workspace in its stage, and that is a
              // question about the layout that a descriptor may not ask.
              reference={{
                type: "workspace",
                value: {
                  spaceId: space.id,
                  name: space.name,
                  stageId,
                  pinned,
                  canDelete: spaces.length > 1,
                },
              }}
              doc={`<workspace> ${space.name}`}
              activate={{
                run: () => void workbench.controller.selectWorkspace(space.id),
                doc: "switch to it",
              }}
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: the interactive element is the Presentation around this span — it carries tabIndex, role and the key handlers. What this span adds is double-click-to-rename; the keyboard route is "Rename this workspace …" in the object menu, which DATADROP-8 added. */}
              <span
                style={{
                  border: "var(--pbui-border-firm)",
                  background:
                    current === space.id ? "var(--pbui-selected)" : "var(--pbui-pane-alt)",
                  padding: "0 var(--pbui-space-4)",
                  fontSize: "var(--pbui-fs-small)",
                  fontWeight: current === space.id ? 700 : 400,
                }}
                onDoubleClick={() => !pinned && dispatch(navigationActions.beginRename(space.id))}
                title={pinned ? "defined in code — cannot be renamed or deleted" : undefined}
              >
                {pinned ? `⌾ ${space.name}` : space.name}
              </span>
            </Presentation>
          );
        })}
        <Button
          variant="raised"
          fill="var(--pbui-tone-source)"
          onClick={() => void workbench.controller.createWorkspace()}
        >
          + workspace
        </Button>
        <Text size="tiny" tone="faint">
          L switches · double-click renames · R for rename / duplicate / delete / export · ⌾ is
          defined in code
        </Text>
      </Stack>
    </Toolbar>
  );
}
