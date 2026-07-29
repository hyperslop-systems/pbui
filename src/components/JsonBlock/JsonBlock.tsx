export interface JsonBlockProps {
  value: unknown;
  maxHeight?: number | "none";
  unstyled?: boolean;
}

/** Pretty-print arbitrary values without allowing circular data or BigInt to crash the host. */
export function JsonBlock({
  value,
  maxHeight = 220,
  unstyled = false,
}: JsonBlockProps) {
  let text: string;
  let failed = false;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch (error) {
    failed = true;
    text = `⚠ this value cannot be shown as JSON — ${
      error instanceof Error ? error.message : String(error)
    }`;
  }

  return (
    <pre
      data-pbui-component="json-block"
      data-part="json-block"
      data-failed={failed || undefined}
      data-unstyled={unstyled || undefined}
      style={maxHeight === "none" ? undefined : { maxHeight }}
    >
      {text}
    </pre>
  );
}
