import { TYPE_LABEL, type FieldType } from "../../../model/table";
import { Chip } from "@hyperslop-systems/pbui";

const TONE: Record<FieldType, string> = {
  q: "var(--pbui-type-q)",
  n: "var(--pbui-type-n)",
  t: "var(--pbui-type-t)",
};

/**
 * A column's type, as a letter and a hue.
 *
 * Both, always. The hue alone does not clear the non-text contrast threshold,
 * and colour is never the sole carrier of meaning (§15). `fill="tone"` paints
 * the type hue at full strength behind the letter; `edge={false}` because this
 * badge names a type by filling with its tone, not by a 4px edge next to it.
 */
export function TypeBadge({ type, overridden }: { type: FieldType; overridden?: boolean }) {
  return (
    <Chip
      label={overridden ? `${type}*` : type}
      tone={TONE[type]}
      size="micro"
      fill="tone"
      edge={false}
      strong
      title={overridden ? `${TYPE_LABEL[type]} — overridden for this chart only` : TYPE_LABEL[type]}
    />
  );
}
