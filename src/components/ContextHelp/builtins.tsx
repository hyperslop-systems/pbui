import type { ReactNode } from "react";
import { Text } from "../foundation";
import { HelpMarkdown } from "./markdown";
import { defineHelpItem } from "./registry";
import type { HelpRendererProps } from "./registry";

/**
 * The five built-in help patterns (design doc §9): text, Markdown, fields,
 * notice, and actions. Every renderer emits its semantic structure under a
 * stable `data-part` (§14) and renders values as TEXT — no built-in has an
 * HTML path. Products needing chips, progress, or charts define a custom
 * typed renderer with `defineHelpItem` instead of extending these.
 */

/* ------------------------------------------------------------------- text -- */

export interface TextHelpPayload {
  text: string;
}

function TextHelp({ item }: HelpRendererProps<TextHelpPayload>) {
  return (
    <p data-part="help-text">
      <Text size="small" prose>
        {item.payload.text}
      </Text>
    </p>
  );
}

export const textHelp = defineHelpItem<TextHelpPayload>("help.text", TextHelp);

/* --------------------------------------------------------------- markdown -- */

export interface MarkdownHelpPayload {
  markdown: string;
  compact?: boolean;
}

function MarkdownHelp({ item }: HelpRendererProps<MarkdownHelpPayload>) {
  return <HelpMarkdown markdown={item.payload.markdown} compact={item.payload.compact ?? false} />;
}

export const markdownHelp = defineHelpItem<MarkdownHelpPayload>("help.markdown", MarkdownHelp);

/* ----------------------------------------------------------------- fields -- */

export interface FieldsHelpPayload {
  fields: readonly {
    label: string;
    value: string;
  }[];
}

function FieldsHelp({ item }: HelpRendererProps<FieldsHelpPayload>) {
  return (
    <dl data-part="help-fields">
      {item.payload.fields.map((field, index) => (
        <div key={index} data-part="help-field">
          <dt>
            <Text size="tiny" tone="faint">
              {field.label}
            </Text>
          </dt>
          <dd>
            <Text size="small">{field.value}</Text>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const fieldsHelp = defineHelpItem<FieldsHelpPayload>("help.fields", FieldsHelp);

/* ----------------------------------------------------------------- notice -- */

export interface NoticeHelpPayload {
  tone: "info" | "warning" | "error";
  message: string;
}

function NoticeHelp({ item }: HelpRendererProps<NoticeHelpPayload>) {
  // The tone is visual metadata only; the message always stands as text, so
  // the state never relies on color alone (§13).
  return (
    <div data-part="help-notice" data-tone={item.payload.tone} role="note">
      <Text size="small" tone={item.payload.tone === "info" ? "default" : "danger"}>
        {item.payload.message}
      </Text>
    </div>
  );
}

export const noticeHelp = defineHelpItem<NoticeHelpPayload>("help.notice", NoticeHelp);

/* ---------------------------------------------------------------- actions -- */

/**
 * The structural slice of a `ResolvedAction` the informational renderer
 * needs. A product builds the payload by resolving the ACTION registry with
 * the same subject and snapshot and passing `resolution.actions` through —
 * `ResolvedAction` satisfies this shape — never by reconstructing
 * applicability by hand (§9.5). v1 rows are informational: no onclick, no
 * verbs, so hover-card focus semantics stay simple. If actions become
 * clickable, clicks must go through `performAction` for fresh revalidation.
 */
export interface ActionsHelpEntry {
  action: string;
  label: ReactNode;
  description?: string;
  danger: boolean;
  status: { kind: "available" } | { kind: "unavailable"; because: string; code?: string };
}

export interface ActionsHelpPayload {
  actions: readonly ActionsHelpEntry[];
}

function ActionsHelp({ item }: HelpRendererProps<ActionsHelpPayload>) {
  if (item.payload.actions.length === 0) {
    return (
      <p data-part="help-actions">
        <Text size="tiny" tone="faint">
          No actions available
        </Text>
      </p>
    );
  }
  return (
    <ul data-part="help-actions">
      {item.payload.actions.map((action) => (
        <li key={action.action} data-part="help-action" data-danger={action.danger || undefined}>
          <Text size="small">{action.label}</Text>
          {action.status.kind === "unavailable" && (
            <span data-part="help-action-reason">
              <Text size="tiny" tone="faint"> — {action.status.because}</Text>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export const actionsHelp = defineHelpItem<ActionsHelpPayload>("help.actions", ActionsHelp);

/** Every built-in, in one list for registry construction. */
export const builtinHelpItems = [textHelp, markdownHelp, fieldsHelp, noticeHelp, actionsHelp];
