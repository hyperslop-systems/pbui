/**
 * Tones arrive from the model as either a pbui `PresentationTone` name
 * ("positive", "danger"), a product type name ("product"), or a ready CSS
 * value. Map all three onto tokens; never a hex value.
 */
export function toneVar(tone: string | undefined, fallback = "var(--pbui-tone-neutral)"): string {
  if (!tone) return fallback;
  switch (tone) {
    case "neutral":
      return "var(--pbui-tone-neutral)";
    case "accent":
      return "var(--pbui-cat-2)";
    case "positive":
    case "ok":
      return "var(--pbui-ok)";
    case "warning":
      return "var(--pbui-cat-3)";
    case "danger":
      return "var(--pbui-danger)";
  }
  if (tone.startsWith("var(")) return tone;
  if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(tone)) return `var(--pbui-tone-${tone}, ${fallback})`;
  return fallback;
}

/** pbui's `Callout` knows three variants; fold the document's tone onto them. */
export function calloutVariant(tone: string | undefined): "info" | "ok" | "warning" {
  switch (tone) {
    case "positive":
    case "ok":
      return "ok";
    case "warning":
    case "danger":
      return "warning";
    default:
      return "info";
  }
}
