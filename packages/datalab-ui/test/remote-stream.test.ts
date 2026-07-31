import { afterEach, describe, expect, test, vi } from "vitest";
import { startWorkbenchStream } from "../src/api/workbenchStream";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remote workbench invalidation stream", () => {
  test("parses exact bigint revisions and aborts the active fetch", async () => {
    let requested = "";
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requested = String(input);
        signal = init?.signal ?? undefined;
        return new Response(
          [
            ": keepalive\n\n",
            "event: workbench.updated\n",
            "id: 9007199254740993\n",
            'data: {"workbenchId":"bench","revision":"9007199254740993"}\n\n',
          ].join(""),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );

    const observed = new Promise<bigint>((resolve) => {
      const cancel = startWorkbenchStream({
        workbenchId: "bench",
        getAfter: () => 7n,
        onRevision: (revision) => {
          cancel();
          resolve(revision);
        },
        onError: (error) => {
          cancel();
          throw error;
        },
      });
    });

    await expect(observed).resolves.toBe(9007199254740993n);
    expect(requested).toBe("/v1/workbenches/bench/stream?after=7");
    expect(signal?.aborted).toBe(true);
  });
});
