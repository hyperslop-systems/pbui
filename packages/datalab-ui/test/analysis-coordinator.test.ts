import { describe, expect, test } from "vitest";
import { AnalysisCoordinator, type AnalysisExecutor } from "../src/appkit/analysisCoordinator";
import type { AnalysisExecution, AnalysisRequest } from "../src/analysis/types";
import type { LogicalGraphic } from "../src/model/graphic";
import type { Table } from "../src/model/table";

const table = { rows: [] } as unknown as Table;
const logical = { operations: [], relations: {}, views: {} } as unknown as LogicalGraphic;
const base = {
  namespace: "doc-1",
  sourceId: "source-1",
  table,
  logical,
  relation: "relation-1",
  maxResultRows: 100,
};

function execution(request: AnalysisRequest): AnalysisExecution {
  return {
    requestId: request.requestId,
    generation: request.generation,
    result: {} as AnalysisExecution["result"],
    metrics: {} as AnalysisExecution["metrics"],
  };
}

async function waitForRequests(fake: FakeExecutor, count: number) {
  for (let attempt = 0; attempt < 20 && fake.requests.length < count; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(fake.requests.length).toBe(count);
}

class FakeExecutor implements AnalysisExecutor {
  requests: AnalysisRequest[] = [];
  resolvers: Array<(value: AnalysisExecution) => void> = [];
  purges = 0;
  disposals = 0;

  execute(request: AnalysisRequest): Promise<AnalysisExecution> {
    this.requests.push(request);
    return new Promise((resolve) => this.resolvers.push(resolve));
  }
  async purge() {
    this.purges += 1;
  }
  async dispose() {
    this.disposals += 1;
  }
  resolve(index: number) {
    this.resolvers[index]!(execution(this.requests[index]!));
  }
}

describe("AnalysisCoordinator", () => {
  test("creates one executor lazily and marks superseded semantic work stale", async () => {
    const fake = new FakeExecutor();
    let loads = 0;
    const coordinator = new AnalysisCoordinator(async () => {
      loads += 1;
      return fake;
    });
    expect(loads).toBe(0);
    const first = coordinator.execute(base);
    const second = coordinator.execute({ ...base, relation: "relation-2" });
    await waitForRequests(fake, 2);
    expect(loads).toBe(1);
    expect(fake.requests.map((request) => request.generation)).toEqual([1, 2]);
    fake.resolve(1);
    expect((await second).status).toBe("current");
    fake.resolve(0);
    expect((await first).status).toBe("stale");
  });

  test("coalesces sibling consumers of the same semantic document work", async () => {
    const fake = new FakeExecutor();
    const coordinator = new AnalysisCoordinator(async () => fake);
    const chart = coordinator.execute(base);
    const tableView = coordinator.execute(base);
    await waitForRequests(fake, 1);
    fake.resolve(0);
    expect((await chart).status).toBe("current");
    expect((await tableView).status).toBe("current");
    expect(coordinator.metrics()).toEqual({
      executions: 1,
      cacheHits: 0,
      coalesced: 1,
      staleDrops: 0,
    });
  });

  test("reuses a completed semantic result without another executor request", async () => {
    const fake = new FakeExecutor();
    const coordinator = new AnalysisCoordinator(async () => fake);
    const first = coordinator.execute(base);
    await waitForRequests(fake, 1);
    fake.resolve(0);
    expect((await first).status).toBe("current");

    const cached = await coordinator.execute(base);
    expect(cached.status).toBe("current");
    expect(fake.requests).toHaveLength(1);
    expect(coordinator.metrics().cacheHits).toBe(1);
  });

  test("uses table identity for source replacement without hashing authorized rows", async () => {
    const fake = new FakeExecutor();
    const coordinator = new AnalysisCoordinator(async () => fake);
    const sameA = coordinator.sourceKey(table, "source-1");
    const sameB = coordinator.sourceKey(table, "source-1");
    const replaced = coordinator.sourceKey({ rows: [] }, "source-1");
    expect(sameA).toBe(sameB);
    expect(replaced).not.toBe(sameA);
  });

  test("principal purge makes in-flight work stale and preserves lazy restart", async () => {
    const fake = new FakeExecutor();
    const coordinator = new AnalysisCoordinator(async () => fake);
    const pending = coordinator.execute(base);
    await waitForRequests(fake, 1);
    const purge = coordinator.purge();
    fake.resolve(0);
    expect((await pending).status).toBe("stale");
    await purge;
    expect(fake.purges).toBe(1);

    const restarted = coordinator.execute(base);
    await waitForRequests(fake, 2);
    expect(fake.requests[1]?.generation).toBe(1);
    fake.resolve(1);
    expect((await restarted).status).toBe("current");
  });

  test("dispose is idempotent and rejects all later execution", async () => {
    const fake = new FakeExecutor();
    const coordinator = new AnalysisCoordinator(async () => fake);
    const pending = coordinator.execute(base);
    await waitForRequests(fake, 1);
    const disposal = coordinator.dispose();
    fake.resolve(0);
    expect((await pending).status).toBe("stale");
    await disposal;
    await coordinator.dispose();
    expect(fake.disposals).toBe(1);
    await expect(coordinator.execute(base)).rejects.toThrow("disposed");
  });
});
