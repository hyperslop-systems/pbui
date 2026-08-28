import type { ReactNode } from "react";
import { usePbuiChat } from "../../context";
import type { Reference } from "../../types";

export interface RefPresentationProps {
  reference: Reference;
  children?: ReactNode;
  block?: boolean;
  className?: string;
  doc?: string;
  activate?: { run?(): void; doc?: string };
  testId?: string;
}

/**
 * Every wire reference the chat layer renders goes through here: it lifts
 * the reference into the product's `Presentation`, supplies the mouse-doc
 * line from the vocabulary when the caller has none, and records the
 * reference as the session's focus while the pointer or keyboard focus rests
 * on it — which is what `sendMessageBody` reports as `focus`.
 *
 * The wrapper element exists only for that capture; it carries no style.
 */
export function RefPresentation({
  reference,
  children,
  block = false,
  className,
  doc,
  activate,
  testId,
}: RefPresentationProps) {
  const chat = usePbuiChat();
  const Presentation = chat.pbui.Presentation;
  const Wrap = block ? "div" : "span";
  const focus = () => chat.store.setFocus(reference);
  return (
    <Wrap data-part="ref" data-ref-type={reference.type} onMouseOverCapture={focus} onFocusCapture={focus}>
      <Presentation
        reference={chat.refs.toProduct(reference)}
        doc={doc ?? chat.docFor(reference.type) ?? `<${reference.type}>`}
        block={block}
        className={className}
        activate={activate}
        testId={testId}
      >
        {children ?? chat.labelFor(reference)}
      </Presentation>
    </Wrap>
  );
}
