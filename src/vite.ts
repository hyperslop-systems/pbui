/**
 * The Vite configuration a pbui consumer needs, so the requirement travels
 * with the package instead of living in each product's memory.
 *
 * # The failure this prevents
 *
 * A `link:`-linked consumer renders one pbui component and the app dies on
 * first paint:
 *
 *     Uncaught TypeError: Cannot read properties of null (reading 'useState')
 *
 * No component in the consumer's own tree is at fault. The stack points into
 * pbui, and every obvious hypothesis — a bad hook call, a conditional hook, a
 * version skew — is wrong. One engineer lost an entire session to it and
 * handed the work off as blocked on "a React error I cannot explain".
 *
 * # The mechanism
 *
 * pbui declares React as a peer dependency AND a devDependency. That pairing
 * is correct and universal for a React library: Storybook and the test suite
 * need a real React to run against, and the peer declaration is what says the
 * consumer supplies the one that ships. The build externalises React, so
 * `dist/index.js` carries a bare `import … from "react"`.
 *
 * The problem is where that bare specifier resolves FROM at the consumer's
 * build time. Under a `link:` override Vite resolves the symlink to pbui's
 * real directory, so Node resolution walks up from *pbui's* path and finds
 * `pbui/node_modules/react` — the devDependency — before ever reaching the
 * consumer's copy. Two React module instances then exist in one page. Hooks
 * live in module-level state, so the dispatcher the second copy reads is
 * `null`, and the first hook call in the first pbui component to render
 * throws.
 *
 * This is not exotic. `link:` is what the family's own development workflow
 * prescribes, so every product following it hits this on the day it first
 * renders a pbui component. A registry install does NOT hit it: npm and pnpm
 * do not install a dependency's devDependencies.
 *
 * # Usage
 *
 *     import { defineConfig } from "vite";
 *     import { pbuiVite } from "@hyperslop-systems/pbui/vite";
 *
 *     export default defineConfig({
 *       ...pbuiVite(),
 *       plugins: [react()],
 *     });
 *
 * or merge just the resolve section if the product has its own:
 *
 *     resolve: { ...pbuiVite().resolve, alias: { … } },
 *
 * # Why there is no runtime guard here
 *
 * A dev-time check that detects two React copies and prints a searchable
 * message would be worth more than this preset, and it cannot be written from
 * inside pbui. pbui holds a handle to exactly one React — its own resolution —
 * and has no way to see the consumer's. Detecting the duplicate requires both
 * sides to register, which is more coordination than the preset it would be
 * protecting. The honest deliverable is the preset plus a symptom-first note
 * in the playbook, filed under the error message rather than under
 * "packaging", because the message is what someone searches for.
 */

export interface PbuiViteConfig {
  resolve: {
    /**
     * Forces a single React instance regardless of which node_modules a bare
     * `react` specifier resolves from.
     */
    dedupe: string[];
  };
}

export function pbuiVite(): PbuiViteConfig {
  return { resolve: { dedupe: ["react", "react-dom"] } };
}
