import { describe, expect, test } from "vitest";
import { routeFor } from "../src/routes";

/**
 * The page router (DATADROP-14).
 *
 * Four pages chosen by pathname. Pure, so it is tested with literals — which is
 * the entire reason it was extracted out of `main.tsx`, where the same logic
 * was a chain of `startsWith` calls that no test could reach without a DOM.
 *
 * The failure this guards is quiet: a route that stops matching does not throw,
 * it renders a *different page*. Someone opening `/ui/device` and getting the
 * workbench has no error to search for.
 */

describe("routeFor", () => {
  test("the root is the marketing page", () => {
    expect(routeFor("/")).toEqual({ kind: "marketing" });
    // Not reachable from window.location.pathname, which is always at least
    // "/", but it is what a caller passing a stripped URL hands over.
    expect(routeFor("")).toEqual({ kind: "marketing" });
  });

  test("the workbench is /ui/ and everything beneath it", () => {
    expect(routeFor("/ui/")).toEqual({ kind: "product" });
    expect(routeFor("/ui")).toEqual({ kind: "product" });
    expect(routeFor("/ui/anything/at/all")).toEqual({ kind: "product" });
  });

  test("the tour and the device screen have their own prefixes", () => {
    expect(routeFor("/ui/tour")).toEqual({ kind: "tour" });
    expect(routeFor("/ui/tour/")).toEqual({ kind: "tour" });
    expect(routeFor("/ui/device")).toEqual({ kind: "device" });
    expect(routeFor("/ui/device/approve")).toEqual({ kind: "device" });
  });

  test("the specific prefixes are matched before the fallback", () => {
    // Stated as its own case rather than trusting the reading order of the
    // source: `product` matches everything, so moving it up by one line makes
    // two pages unreachable and breaks no other test here.
    for (const path of ["/ui/tour", "/ui/device"]) {
      expect(routeFor(path).kind).not.toBe("product");
    }
  });

  test("a path that merely CONTAINS a prefix is not that route", () => {
    // `/ui/tourists` starting with `/ui/tour` is the hazard of prefix matching,
    // and it is accepted deliberately — there is no such path, and requiring an
    // exact segment boundary would break `/ui/tour/objects`. This test exists to
    // make the acceptance explicit rather than accidental, so that adding a
    // real `/ui/tourists` is a decision rather than a surprise.
    expect(routeFor("/ui/tourists").kind).toBe("tour");
    // Whereas a path that does not start with the prefix is unaffected.
    expect(routeFor("/uitour").kind).toBe("product");
    expect(routeFor("/tour").kind).toBe("product");
  });

  test("the API's own paths are never a page", () => {
    // They never reach the SPA — pkg/webui serves the shell at exactly "/" and
    // under "/ui/" only, so "/v1/…" is a 404 from the API (DR-90). If that ever
    // changed, this is the assertion that would have to change with it.
    expect(routeFor("/v1/me").kind).toBe("product");
    expect(routeFor("/healthz").kind).toBe("product");
  });
});
