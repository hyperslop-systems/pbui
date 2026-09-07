import { useId, useState, type ReactNode } from "react";
import {
  AppBody, Button, Callout, EmptyState, KeyValueList,
  SectionLabel, Text, TextInput, Toolbar,
} from "@hyperslop-systems/pbui";
import { layout, tile } from "@hyperslop-systems/workbench-core";
import { defineWorkbenchApp } from "../../app";
import { createWorkbench } from "../../createWorkbenchShell";
import { AppShell } from "../../components/AppShell";
import styles from "./StyledPanel.module.css";

export type PanelState = "ready" | "loading" | "empty" | "error" | "disabled";
export interface StyledPanelProps {
  value: string;
  state?: PanelState;
  onValueChange(value: string): void;
  onInspect(): void;
  /** Plain React content: this panel does not require a presentation provider. */
  details?: ReactNode;
}

/** DTOs and callbacks only. The fixture controller below owns the interaction. */
export function StyledPanel({
  value, state = "ready", onValueChange, onInspect, details,
}: StyledPanelProps) {
  const inputId = useId();
  const disabled = state === "loading" || state === "disabled" || !value.trim();
  const reason = state === "loading"
    ? "Loading; inspection is unavailable."
    : state === "disabled"
      ? "Inspection is disabled in this example state."
      : "Enter a name to inspect.";

  return (
    <AppBody>
      <Toolbar bordered>
        <SectionLabel>Local fixture</SectionLabel>
        <Text size="tiny" tone="faint">No network or persistence</Text>
      </Toolbar>
      <Toolbar>
        <label htmlFor={inputId}>Name</label>
        <TextInput
          id={inputId}
          accessibleName="Fixture name"
          width="fill"
          value={value}
          onValueChange={onValueChange}
          disabled={state === "loading"}
        />
        <Button variant="framed" disabled={disabled} onClick={onInspect}>Inspect</Button>
      </Toolbar>
      {disabled && <Text size="small" tone="faint">{reason}</Text>}
      {state === "loading" ? (
        <EmptyState message="Loading fixture…" />
      ) : state === "empty" ? (
        <EmptyState message="No result selected" hint="Enter a name and press Inspect." />
      ) : state === "error" ? (
        <Callout
          variant="danger"
          title="Fixture unavailable"
          hint="This is a synthetic error, not a failed network request."
        >
          Choose another example state to continue.
        </Callout>
      ) : (
        <KeyValueList items={[
          { key: "Name", value: <span className={styles.value}>{value}</span> },
          { key: "Amount", value: "120.00" },
        ]} />
      )}
      {details}
    </AppBody>
  );
}

/** Controlled demo; editing does not inspect. Remount resets synthetic local state. */
export function StyledPanelDemo({
  state = "ready", initialValue = "Example order", details,
}: { state?: PanelState; initialValue?: string; details?: ReactNode }) {
  const [value, setValue] = useState(initialValue);
  const [inspected, setInspected] = useState<string>();
  return (
    <StyledPanel
      value={value}
      state={state}
      onValueChange={setValue}
      onInspect={() => setInspected(value)}
      details={
        <>
          {details}
          {inspected !== undefined && (
            <Callout variant="info" title="Inspected value">{inspected}</Callout>
          )}
        </>
      }
    />
  );
}

/** Native shell, registry and document, not hand-drawn chrome. No ports declared. */
export function StyledWorkbench() {
  const [workbench] = useState(() => createWorkbench({
    apps: [defineWorkbenchApp({
      manifest: {
        id: "styled-fixture",
        viewCardinality: "one",
        duplicatePlacement: "link",
      },
      presentation: {
        title: "Styled fixture",
        tone: "var(--pbui-tone-order)",
        Component: () => <StyledPanelDemo />,
      },
    })],
    initial: layout(tile("styled-fixture")),
  }));

  return (
    <div className={styles.host}>
      <AppShell
        wordmark="PBUI style example"
        strip={<workbench.WorkspaceStrip />}
        mastheadActions={
          <>
            <Button variant="framed" onClick={() => workbench.dispatch({ kind: "launcher.open" })}>
              Applications
            </Button>
            <Button variant="framed" onClick={() => workbench.dispatch({ kind: "link.mode.open" })}>
              Wiring
            </Button>
          </>
        }
      >
        <workbench.Surface />
        <workbench.Launcher />
        <workbench.Rebalance />
      </AppShell>
    </div>
  );
}
