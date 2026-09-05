import type { ReactNode } from "react";
import { KeyValueList, Text } from "@hyperslop-systems/pbui";
import styles from "./ModuleCard.module.css";

export function ModuleCard({
  title,
  what,
  emits,
  accepts,
  lr,
  vs,
}: {
  title: string;
  what: ReactNode;
  emits: ReactNode;
  accepts: ReactNode;
  lr: ReactNode;
  vs: ReactNode;
}) {
  return (
    <div className={styles.card}>
      <Text size="small" strong>
        <span className={styles.title}>{title}</span>
      </Text>
      <KeyValueList
        items={[
          { key: "For", value: what },
          { key: "Emits", value: emits },
          { key: "Accepts", value: accepts },
          { key: "L / R", value: lr },
          { key: "Not to be", value: vs },
        ]}
      />
    </div>
  );
}
