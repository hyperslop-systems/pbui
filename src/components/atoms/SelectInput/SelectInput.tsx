import type { SelectHTMLAttributes } from "react";
import styles from "./SelectInput.module.css";

/**
 * A dropdown over a closed set.
 *
 * Nine hand-written `<select>` elements, in three different inline styles:
 * `{ font: "inherit" }` in UploadApp and TokensApp,
 * `{ font: "inherit", fontSize: "var(--pbui-fs-tiny)" }` twice in MemberList,
 * and unstyled elsewhere. The divergence is the same story as the buttons
 * (guide §7.2) at smaller scale.
 *
 * `options` is data rather than children, which is what lets a story render
 * every state of this control without JSX gymnastics — and what stops a caller
 * putting anything other than an `<option>` inside a `<select>`, which browsers
 * handle in six different ways.
 *
 * `placeholder` renders as a disabled-looking empty-valued option, reproducing
 * the "choose a drop…" entry UploadApp writes by hand. It is deliberately
 * selectable: the upload form treats "no drop chosen" as a real state that
 * disables the surface below it, and making the option unselectable would strand
 * anyone who wanted to get back to it.
 */
export interface SelectOption {
  value: string;
  label: string;
  /**
   * Present ⇔ the option is unselectable, and the string is why.
   *
   * The reason is appended to the label after an em dash and used as the
   * `title`. It lives on the option rather than in the caller's `label` string
   * because the two render differently, and because a `title` on a disabled
   * option is the only hover affordance a native select has.
   *
   * # One field, matching `PresentationAction`
   *
   * This was `disabled?: boolean` plus `reason?: string`, and the render
   * guarded on `reason` being set rather than on the option being disabled —
   * the object menu's defect, reproduced here independently, down to the em
   * dash. A selectable option would have read "Parquet — needs a paid plan"
   * while selecting it worked fine. It never shipped for one reason only: no
   * caller had passed `reason` yet.
   *
   * Three components in this library grew that pair by hand and two guarded it
   * wrong, which is why the fix is the shape rather than the guard. See
   * `PresentationAction.disabledBecause` for the full argument.
   *
   * # A native `<option disabled>` is the right primitive
   *
   * Unselectable by mouse AND keyboard in every browser, and announced as
   * unavailable by screen readers. Building a custom listbox to get a nicer
   * grey would be a large accessibility regression for a cosmetic gain.
   *
   * **This says nothing about WHEN to grey rather than omit.** It used to: the
   * comment here asserted "never hidden" as a project-wide policy, citing
   * `verbs.ts`. That policy no longer holds everywhere. The tile picker hides
   * (DATADROP-14 DR-95) because twenty-two greyed rows out of twenty-five bury
   * the three that work; verb menus still grey, because a verb menu is short
   * and the greyed entry teaches. The rule is a property of the list, not of
   * this control, and each caller states its own.
   *
   * Live callers: the drop and role selects in `MemberList`, and the upload
   * form. Both are short lists where a greyed entry is informative.
   */
  disabledBecause?: string;

  /**
   * TOMBSTONES — see `PresentationAction.disabled` for why these are typed
   * `never` rather than deleted. Options reach this component inside an array
   * prop, which is checked by assignability rather than by the excess-property
   * rule, so a deleted field would be silently ignored and every disabled
   * option would become selectable.
   *
   * @deprecated merged into `disabledBecause`
   */
  disabled?: never;
  /** @deprecated merged into `disabledBecause` */
  reason?: never;
}

export interface SelectInputProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "onChange" | "value" | "children" | "size" | "aria-label"
  > {
  value: string;
  onValueChange(value: string): void;
  /** Becomes `aria-label`. */
  label: string;
  options: readonly SelectOption[];
  /** Shown as the empty-valued first entry. */
  placeholder?: string;
  /**
   * The same pair Button has, and for the same reason: the codebase already
   * contains both. UploadApp, TokensApp, MemberList and the shell leave the
   * native chrome alone; SourceApp draws a hairline border and a pane
   * background around it, matching the text fields beside it.
   */
  variant?: "native" | "framed";
  size?: "tiny" | "small";
  /**
   * `compact` is PipelineApp's step editor, which caps its selects at 60-90px
   * so that a whole step reads as one line. Everything else takes the default.
   */
  width?: "auto" | "compact";
}

export function SelectInput({
  value,
  onValueChange,
  label,
  options,
  placeholder,
  variant = "native",
  size = "small",
  width = "auto",
  className,
  ...rest
}: SelectInputProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={[styles.root, styles[variant], styles[size], styles[width], className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          /* One field, so there is no second one to disagree with it. */
          disabled={option.disabledBecause !== undefined}
          title={option.disabledBecause}
        >
          {option.disabledBecause ? `${option.label} — ${option.disabledBecause}` : option.label}
        </option>
      ))}
    </select>
  );
}
