import { Callout } from "@hyperslop-systems/pbui";
import { defineWidget, type WidgetProps } from "@go-go-golems/chat-provider";
import { usePbuiChat } from "../context";
import { ERROR_WIDGET_NAME, REFS_WIDGET_NAME, WIDGET_WIDGET_NAME } from "../refs/referenceIndex";
import type { WidgetDocument } from "../vocabulary/schemas";
import { DEFAULT_WIDGET_LIMITS, validateWidgetDocument } from "../vocabulary/validate";
import { PbuiWidget } from "./PbuiWidget";

/** `pbui.refs` renders nothing: it exists to feed the reference index. */
function RefsWidget(_props: WidgetProps) {
  return null;
}

function DocumentWidget({ instanceId, status, props }: WidgetProps) {
  const chat = usePbuiChat();
  const problem = validateWidgetDocument(chat.vocabulary, props, DEFAULT_WIDGET_LIMITS, { verbs: "lenient" });
  if (problem) {
    return (
      <Callout variant="warning" title="invalid widget document">
        {problem}
      </Callout>
    );
  }
  return (
    <PbuiWidget
      document={props as unknown as WidgetDocument}
      instanceId={instanceId}
      status={status}
      parentMessageId={typeof props.parentMessageId === "string" ? props.parentMessageId : undefined}
      validated
    />
  );
}

function ErrorWidget({ props }: WidgetProps) {
  const message = typeof props.message === "string" ? props.message : "the server could not publish this widget";
  return (
    <Callout variant="warning" title="widget error">
      {message}
    </Callout>
  );
}

export const refsWidget = defineWidget(REFS_WIDGET_NAME, RefsWidget);
export const documentWidget = defineWidget(WIDGET_WIDGET_NAME, DocumentWidget);
export const errorWidget = defineWidget(ERROR_WIDGET_NAME, ErrorWidget);

export const pbuiWidgets = [refsWidget, documentWidget, errorWidget];
