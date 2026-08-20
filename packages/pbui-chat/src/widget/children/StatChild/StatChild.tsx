import { Text } from "@hyperslop-systems/pbui";
import styles from "./StatChild.module.css";

export interface StatChildProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string | number;
}

function deltaTone(delta: string | number): "ok" | "danger" | "faint" {
  const n = typeof delta === "number" ? delta : Number(String(delta).replace(/[^-\d.]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "faint";
  return n > 0 ? "ok" : "danger";
}

/** One number with its name, unit and change — a KPI tile at chip scale. */
export function StatChild({ label, value, unit, delta }: StatChildProps) {
  return (
    <div data-part="stat" className={styles.stat}>
      <Text size="tiny" tone="faint" className={styles.label}>
        {label}
      </Text>
      <span className={styles.value}>
        <Text size="title" strong>
          {typeof value === "number" ? value.toLocaleString() : value}
        </Text>
        {unit && (
          <Text size="small" tone="faint">
            {unit}
          </Text>
        )}
      </span>
      {delta !== undefined && (
        <Text size="small" tone={deltaTone(delta)} className={styles.delta}>
          {typeof delta === "number" && delta > 0 ? `+${delta}` : String(delta)}
        </Text>
      )}
    </div>
  );
}
