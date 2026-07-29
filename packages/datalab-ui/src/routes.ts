/**
 * Which page this URL is.
 *
 * A pure function with a test, replacing a chain of `startsWith` calls in
 * `main.tsx` that had neither. The chain was three cases and readable; it is
 * four now, the order between them matters, and the failure mode of getting it
 * wrong is that a whole page becomes unreachable with nothing to indicate it.
 *
 * ## The order is load-bearing
 *
 * `product` is the fallback and matches everything, so it must come last. The
 * two `/ui/` prefixes must come before it and cannot overlap each other.
 * `routes.test.ts` states this as its own case rather than trusting the reading
 * order of this file.
 *
 * ## Deliberately not a router
 *
 * No library, no history integration, no nested routes. The application has
 * four pages, three of which are entered by typing a URL and never left, and
 * the workbench's own navigation is stages and workspaces rather than paths.
 * A router would be a dependency, a bundle, and a second navigation model
 * beside the one the product already has.
 */

export type Route =
  /** The marketing page. Served at exactly `/` — see pkg/webui (DR-90). */
  | { kind: "marketing" }
  /** The interactive tour, which is the marketing page scrolled to #tutorial. */
  | { kind: "tour" }
  /** The device-pairing approval screen. */
  | { kind: "device" }
  /** The workbench: `/ui/` and anything beneath it. */
  | { kind: "product" };

export function routeFor(pathname: string): Route {
  // The empty string is not reachable from `window.location.pathname`, which is
  // always at least "/", but it IS what a test or a caller passing a stripped
  // URL will hand over. Treating it as the root costs one condition.
  if (pathname === "" || pathname === "/") return { kind: "marketing" };
  if (pathname.startsWith("/ui/device")) return { kind: "device" };
  if (pathname.startsWith("/ui/tour")) return { kind: "tour" };
  return { kind: "product" };
}
