import { readToken } from "./client";
import { parseWorkbenchUpdatedEventJSON } from "./workbenchProtocol";

export interface WorkbenchStreamOptions {
  workbenchId: string;
  getAfter: () => bigint;
  onRevision: (revision: bigint) => void;
  onError: (error: Error) => void;
}

/**
 * Start a reconnecting authenticated SSE reader.
 *
 * Fetch is used instead of EventSource because a browser may deliberately use
 * a session-scoped bearer token. EventSource cannot attach Authorization.
 */
export function startWorkbenchStream(options: WorkbenchStreamOptions): () => void {
  const controller = new AbortController();
  void reconnect(options, controller.signal);
  return () => controller.abort();
}

async function reconnect(options: WorkbenchStreamOptions, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await readOneStream(options, signal);
    } catch (error) {
      if (signal.aborted) return;
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
    if (signal.aborted) return;
    await delay(1_000, signal);
  }
}

async function readOneStream(options: WorkbenchStreamOptions, signal: AbortSignal): Promise<void> {
  const after = options.getAfter();
  const token = readToken();
  const response = await fetch(
    `/v1/workbenches/${encodeURIComponent(options.workbenchId)}/stream?after=${after.toString()}`,
    {
      credentials: "same-origin",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`workbench stream returned HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("workbench stream has no response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let eventName = "";
  let data = "";

  const dispatch = () => {
    if (eventName === "workbench.updated" && data !== "") {
      const event = parseWorkbenchUpdatedEventJSON(JSON.parse(data));
      options.onRevision(event.revision);
    }
    eventName = "";
    data = "";
  };

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, "");
      pending = pending.slice(newline + 1);
      if (line === "") dispatch();
      else if (line.startsWith("event:")) eventName = line.slice("event:".length).trim();
      else if (line.startsWith("data:")) {
        const part = line.slice("data:".length).replace(/^ /, "");
        data += data === "" ? part : `\n${part}`;
      }
      newline = pending.indexOf("\n");
    }
    if (done) {
      if (pending !== "") {
        const line = pending.replace(/\r$/, "");
        if (line.startsWith("data:")) data += line.slice("data:".length).replace(/^ /, "");
      }
      dispatch();
      return;
    }
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
