import { ResultLog, type ResultLine } from "@hyperslop-systems/pbui";

export interface LogChildProps {
  entries: readonly { level?: string; text: string; at?: string }[];
}

/** A log child is pbui's `ResultLog` with one text segment per entry. */
export function LogChild({ entries }: LogChildProps) {
  const lines: ResultLine[] = entries.map((entry, i) => ({
    id: `${i}`,
    segments: [
      {
        kind: "text",
        text: [entry.at, entry.level ? `[${entry.level}]` : null, entry.text].filter(Boolean).join(" "),
      },
    ],
  }));
  return <ResultLog lines={lines} accessibleName="log" follow={false} />;
}
