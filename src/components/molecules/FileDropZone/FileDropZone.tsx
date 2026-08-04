import { useRef, useState } from "react";
import { Button } from "../../atoms";
import { Text } from "../../foundation";
import { Stack, Toolbar } from "../../layout";
import styles from "./FileDropZone.module.css";

/**
 * Where files come in.
 *
 * Two affordances, and both are necessary. A drop target alone assumes a mouse,
 * a window arrangement that lets you see the file manager and the browser at
 * once, and the knowledge that the surface is droppable at all — none of which
 * a keyboard user has. The button assumes none of them, and it is the one a
 * screen reader reaches.
 *
 * Holds the only `<input type="file">` in the tree. It is `hidden` rather than
 * styled-invisible: a hidden input is out of the tab order, which is correct,
 * because the button in front of it is the tab stop and clicking that opens the
 * picker.
 *
 * `disabledReason` rather than a bare `disabled`, because "choose a drop and
 * name the dataset first" is the entire content of the disabled state. A greyed
 * box with no sentence is a puzzle.
 */
export function FileDropZone({
  onFiles,
  disabledBecause,
  accept,
  label = "drop files here, or click to choose",
  buttonLabel = "Choose files…",
}: {
  onFiles(files: FileList): void;
  /**
   * Present ⇔ the zone rejects files, and the string is why — shown in place
   * of `label`. Say what to do, not what is wrong: "choose a drop and name the
   * dataset first" rather than "no drop selected".
   *
   * The third of the three `disabled` + explanation pairs in this library, and
   * the only one whose render guarded correctly. The type still permitted the
   * disconnect, and permitted the quieter defect the other two shared: a
   * disabled zone with no reason, which fell back to the generic label and told
   * the user nothing. Neither is expressible now. See
   * `PresentationAction.disabledBecause`.
   */
  disabledBecause?: string;
  /**
   * TOMBSTONES — see `PresentationAction.disabled`. JSX props ARE checked by
   * the excess-property rule, so deleting these would already be an error
   * here; they are kept for a clearer message and for symmetry with the other
   * two, which need them.
   *
   * @deprecated merged into `disabledBecause`
   */
  disabled?: never;
  /** @deprecated merged into `disabledBecause` */
  disabledReason?: never;
  accept?: string;
  label?: string;
  buttonLabel?: string;
}) {
  const disabled = disabledBecause !== undefined;
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = () => {
    if (!disabled) input.current?.click();
  };

  return (
    <Stack gap={2} data-part="file-drop-zone">
      <Toolbar tight>
        <Button disabled={disabled} onClick={open} data-testid="choose-files">
          {buttonLabel}
        </Button>
        <Text size="tiny" tone="faint">
          or drop them below
        </Text>
      </Toolbar>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target is a pointer gesture with no keyboard equivalent. The keyboard path is the "choose files" Button above — it is the tab stop and opens the same hidden <input type=file>, so this zone is an additional affordance and never the only one. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: same reason — this click opens the picker the Button already opens, so a key handler would be a second route to one dialog rather than an access route. */}
      <div
        className={[styles.zone, dragging ? styles.dragging : "", disabled ? styles.disabled : ""]
          .filter(Boolean)
          .join(" ")}
        data-state={dragging ? "acceptable" : undefined}
        data-testid="drop-zone"
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) onFiles(event.dataTransfer.files);
        }}
        onClick={open}
      >
        <Text size="small" tone={disabled ? "faint" : undefined}>
          {/* No `?? label` fallback: a disabled zone now always has a reason. */}
          {disabledBecause ?? label}
        </Text>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="files to upload"
          accept={accept}
          onChange={(event) => {
            if (event.target.files) onFiles(event.target.files);
          }}
        />
      </div>
    </Stack>
  );
}
