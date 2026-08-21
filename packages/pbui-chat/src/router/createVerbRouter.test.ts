import { describe, expect, test, vi } from "vitest";
import { vocabulary } from "../../demo/src/pbui/vocabulary";
import { createPbuiChatStore } from "../store/chatStore";
import type { Reference } from "../types";
import { createVerbRouter, targetOf, type RouterBinding } from "./createVerbRouter";

const product: Reference = { type: "product", id: "2049", value: { name: "Eagle" } };

function binding(fetchImpl: typeof fetch, sessionId = "s1"): RouterBinding {
  return {
    store: createPbuiChatStore(),
    conversation: () => (sessionId ? { id: sessionId, client: {} as never } : null),
    runtimeFor: () => null,
    vocabulary,
    basePrefix: "/app",
    accept: async () => null,
    labelFor: (r) => r.id,
    sendToAgent: async () => undefined,
    openTile: () => undefined,
    ...({ fetch: fetchImpl } as object),
  };
}

function okFetch() {
  return vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
}

describe("createVerbRouter", () => {
  test("dispatches by family and POSTs the trace with lowerCamel keys", async () => {
    const fetchImpl = okFetch();
    const local = vi.fn();
    const router = createVerbRouter<{ kind: string } & Record<string, unknown>>({
      families: () => "local",
      local,
      fetch: fetchImpl,
    });
    router.bind(binding(fetchImpl));

    const outcome = await router.perform({ kind: "inspect", ref: product });
    expect(outcome).toBe("performed");
    expect(local).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/app/api/chat/sessions/s1/verbs");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      clientSeq: expect.stringMatching(/^\d+-1$/),
      actor: "human",
      verb: { kind: "inspect", ref: product },
      target: product,
      outcome: "performed",
    });
  });

  test("serializes reports in perform invocation order", async () => {
    let releaseFirst!: () => void;
    const firstResponse = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const bodies: Array<{ verb: { kind: string; ref?: Reference } }> = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) await firstResponse;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const router = createVerbRouter<{ kind: string; ref: Reference }>({ families: () => "local", local: () => undefined, fetch: fetchImpl });
    router.bind(binding(fetchImpl));

    const first = router.perform({ kind: "inspect", ref: product });
    const second = router.perform({ kind: "inspect", ref: { ...product, id: "2050" } });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    releaseFirst();
    await Promise.all([first, second]);

    expect(bodies.map((body) => body.verb.ref?.id)).toEqual(["2049", "2050"]);
  });

  test("invalid verbs are rejected without dispatch, and still reported", async () => {
    const fetchImpl = okFetch();
    const local = vi.fn();
    const router = createVerbRouter<{ kind: string } & Record<string, unknown>>({ families: () => "local", local, fetch: fetchImpl });
    router.bind(binding(fetchImpl));

    expect(await router.perform({ kind: "frobnicate" })).toBe("rejected:unknown verb frobnicate");
    expect(await router.perform({ kind: "inspect" })).toBe("rejected:verb inspect is missing ref");
    expect(local).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String(((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.outcome).toBe("rejected:unknown verb frobnicate");
  });

  test("a throwing handler becomes a rejected outcome; agent actor is honoured", async () => {
    const fetchImpl = okFetch();
    const router = createVerbRouter<{ kind: string } & Record<string, unknown>>({
      families: () => "agent",
      agent: async () => {
        throw new Error("cancelled");
      },
      fetch: fetchImpl,
    });
    router.bind(binding(fetchImpl));
    expect(await router.perform({ kind: "askAgent", template: "x", refs: [product] }, undefined, { actor: "agent" })).toBe(
      "rejected:cancelled",
    );
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.actor).toBe("agent");
    expect(body.target).toEqual(product);
  });

  test("no session id means nothing is reported; unbound router rejects", async () => {
    const fetchImpl = okFetch();
    const router = createVerbRouter<{ kind: string } & Record<string, unknown>>({ families: () => "local", local: () => undefined, fetch: fetchImpl });
    expect(await router.perform({ kind: "inspect", ref: product })).toBe("rejected:router is not bound to a chat");
    router.bind(binding(fetchImpl, ""));
    expect(await router.perform({ kind: "inspect", ref: product })).toBe("performed");
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("targetOf picks the verb's own reference", () => {
    expect(targetOf({ kind: "inspect", ref: product })).toEqual(product);
    expect(targetOf({ kind: "compareWith", left: product })).toEqual(product);
    expect(targetOf({ kind: "askAgent", refs: [product] })).toEqual(product);
    expect(targetOf({ kind: "openInTile", widgetId: "w" })).toBeUndefined();
  });
});
