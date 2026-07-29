import type { GraphicDocument } from "./graphic";

const KEY = "graphic";

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (value) => value.charCodeAt(0)));
}

export function encodeSpec(document: GraphicDocument): string {
  return encodeBase64Url(JSON.stringify(document));
}

/** Decode only the current canonical format; old legacy chart format fragments are rejected. */
export function decodeSpec(encoded: string): GraphicDocument | null {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(encoded));
    if (!parsed || typeof parsed !== "object") return null;
    const document = parsed as Partial<GraphicDocument>;
    if (
      document.format !== "datadrop.gog.document" ||
      document.version !== 1 ||
      typeof document.id !== "string" ||
      typeof document.name !== "string" ||
      !document.sources ||
      !document.transforms ||
      !document.views ||
      typeof document.rootView !== "string" ||
      !document.parameters
    ) {
      return null;
    }
    return document as GraphicDocument;
  } catch {
    return null;
  }
}

export function specFromHash(hash: string): GraphicDocument | null {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get(KEY);
  return encoded ? decodeSpec(encoded) : null;
}

export function hashForSpec(document: GraphicDocument): string {
  return `#${KEY}=${encodeSpec(document)}`;
}

export function syncHash(document: GraphicDocument): void {
  const next = hashForSpec(document);
  if (typeof window === "undefined" || window.location.hash === next) return;
  window.history.replaceState(null, "", next);
}
