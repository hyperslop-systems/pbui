import { Button, SelectInput, Text, TextInput } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { RefPresentation } from "../../../components/RefPresentation";
import { usePbuiChat } from "../../../context";
import { formatMention } from "../../../mentions/mentions";
import type { Reference } from "../../../types";

import type { FormChild as FormChildDocument, FormField } from "../../../vocabulary/schemas";
import styles from "./FormChild.module.css";

export interface FormChildProps {
  child: FormChildDocument;
}

type FieldValue = string | Reference | null;

/**
 * A form the model asked for. Text, number and select inputs are the design
 * system's; an `object` field has a "pick…" button that enters accept mode
 * for the field's `accepts` types, so the answer is a presentation rather
 * than a typed id.
 *
 * Submitting performs the document's `verb` with the values merged in when
 * it names one; otherwise the values are sent to the agent as a message with
 * the picked references attached — the model asked, the model gets told.
 */
export function FormChild({ child }: FormChildProps) {
  const chat = usePbuiChat();
  const pbui = chat.pbui.usePbui();
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const set = (name: string, value: FieldValue) => setValues((v) => ({ ...v, [name]: value }));

  const missing = child.fields.filter((f) => f.required && !values[f.name]).map((f) => f.label);
  const disabledBecause = submitted
    ? "already submitted"
    : busy
      ? "submitting"
      : missing.length > 0
        ? `needs ${missing.join(", ")}`
        : undefined;

  const pick = async (field: FormField) => {
    const types = field.accepts && field.accepts.length > 0 ? field.accepts : Object.keys(chat.vocabulary.types);
    const picked = await pbui.accept({ types, prompt: `pick ${field.label}` });
    if (picked) set(field.name, chat.refs.fromProduct(picked));
  };

  const submit = async () => {
    if (disabledBecause) return;
    setBusy(true);
    setSubmitError(undefined);
    try {
      const plain: Record<string, unknown> = {};
      const refs: Reference[] = [];
      for (const field of child.fields) {
        const value = values[field.name];
        if (value && typeof value === "object") {
          refs.push(value);
          plain[field.name] = value;
        } else if (field.input === "number" && value) {
          plain[field.name] = Number(value);
        } else {
          plain[field.name] = value ?? null;
        }
      }
      if (child.verb) {
        const outcome = await chat.router.perform({ ...(child.verb as { kind: string }), values: plain });
        if (outcome.startsWith("rejected:")) throw new Error(outcome.slice("rejected:".length));
      } else {
        const parts = child.fields.map((field) => {
          const value = values[field.name];
          const shown =
            value && typeof value === "object" ? formatMention(value, chat.labelFor(value)) : String(value ?? "");
          return `${field.label}: ${shown}`;
        });
        await chat.send({ prompt: `${child.submitLabel ?? "Form"} — ${parts.join("; ")}`, refs });
      }
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      data-part="form"
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {child.fields.map((field) => (
        <label key={field.name} className={styles.field} data-input={field.input}>
          <Text size="tiny" tone="faint" className={styles.label}>
            {field.label}
            {field.required ? " *" : ""}
          </Text>
          <FieldInput field={field} value={values[field.name] ?? null} onChange={(v) => set(field.name, v)} onPick={() => void pick(field)} />
        </label>
      ))}
      <div className={styles.actions}>
        <Button type="submit" variant="raised" size="small" disabled={disabledBecause !== undefined} title={disabledBecause}>
          {child.submitLabel ?? "Submit"}
        </Button>
        {(submitError || disabledBecause) && (
          <Text size="tiny" tone={submitError ? "danger" : "faint"}>
            {submitError ?? disabledBecause}
          </Text>
        )}
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onPick,
}: {
  field: FormField;
  value: FieldValue;
  onChange(value: FieldValue): void;
  onPick(): void;
}) {
  switch (field.input) {
    case "select":
      return (
        <SelectInput
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          accessibleName={field.label}
          options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
          placeholder="choose…"
          variant="framed"
        />
      );
    case "object":
      return (
        <span className={styles.pick}>
          {value && typeof value === "object" ? (
            <RefPresentation reference={value} />
          ) : (
            <Text size="small" tone="faint">
              nothing picked
            </Text>
          )}
          <Button variant="framed" size="tiny" onClick={onPick}>
            pick…
          </Button>
        </span>
      );
    case "number":
      return (
        <TextInput
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          accessibleName={field.label}
          inputMode="decimal"
          invalid={typeof value === "string" && value !== "" && !Number.isFinite(Number(value))}
          size="small"
          width="compact"
        />
      );
    default:
      return (
        <TextInput
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          accessibleName={field.label}
          size="small"
          width="fill"
        />
      );
  }
}
