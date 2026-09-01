import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Prove the PACKED package works for a stranger: pack this package and the
 * workspace packages it depends on, install them into a throwaway consumer
 * from the public registry, and typecheck + build a page that mounts a
 * CodeEditor. Mirrors datalab-ui's smoke; the failure it guards against is a
 * dist that works in the monorepo (where `workspace:^` hides a missing
 * export or a bundling mistake) and not from the tarball.
 */
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(dirname(packageRoot));
const smokeRoot = await mkdtemp(join(tmpdir(), "pbui-editor-consumer-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(smokeRoot, ".npm-cache"),
  npm_config_registry: "https://registry.npmjs.org",
};

function run(command, args, cwd = smokeRoot) {
  execFileSync(command, args, { cwd, stdio: "inherit", env: npmEnvironment });
}

async function pack(root, prefix) {
  run("pnpm", ["pack", "--pack-destination", smokeRoot], root);
  const matches = (await readdir(smokeRoot)).filter((name) => name.startsWith(prefix) && name.endsWith(".tgz"));
  if (matches.length !== 1) throw new Error(`expected one ${prefix} tarball, found ${matches.length}`);
  return join(smokeRoot, matches[0]);
}

try {
  const pbuiTarball = await pack(workspaceRoot, "hyperslop-systems-pbui-0");
  const protocolTarball = await pack(join(workspaceRoot, "packages", "workbench-protocol"), "hyperslop-systems-workbench-protocol-");
  const workbenchTarball = await pack(join(workspaceRoot, "packages", "pbui-workbench"), "hyperslop-systems-pbui-workbench-");
  const editorTarball = await pack(packageRoot, "hyperslop-systems-pbui-editor-");

  await writeFile(
    join(smokeRoot, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: { typecheck: "tsc --noEmit", build: "vite build" },
        dependencies: {
          "@hyperslop-systems/pbui": `file:${pbuiTarball}`,
          "@hyperslop-systems/pbui-editor": `file:${editorTarball}`,
          "@hyperslop-systems/pbui-workbench": `file:${workbenchTarball}`,
          "@hyperslop-systems/workbench-protocol": `file:${protocolTarball}`,
          react: "^19.2.8",
          "react-dom": "^19.2.8",
        },
        devDependencies: {
          "@types/react": "^19.2.17",
          "@types/react-dom": "^19.2.3",
          typescript: "^7.0.2",
          vite: "^8.1.5",
        },
      },
      null,
      2,
    ),
  );

  await writeFile(
    join(smokeRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
  );

  await writeFile(join(smokeRoot, "index.html"), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n');
  await mkdir(join(smokeRoot, "src"));
  // `vite/client` declares `*.css` modules, which the packed d.ts files'
  // side-effect imports need under skipLibCheck: false — same as core's smoke.
  await writeFile(join(smokeRoot, "src", "vite-env.d.ts"), '/// <reference types="vite/client" />\n');
  await writeFile(
    join(smokeRoot, "src", "main.tsx"),
    `
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CodeEditor, EditorView, type EditorDiagnostic } from "@hyperslop-systems/pbui-editor";
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-editor/styles.css";

const diagnostics: EditorDiagnostic[] = [{ line: 1, column: 7, severity: "error", message: "smoke" }];

function App() {
  const [value, setValue] = useState("const a = 1;");
  return <CodeEditor value={value} onValueChange={setValue} accessibleName="smoke" diagnostics={diagnostics} rows={4} onRun={() => {}} />;
}

// The bundled CodeMirror is reachable from the consumer.
void EditorView;
createRoot(document.getElementById("root")!).render(<App />);
`,
  );

  run("npm", ["install", "--no-audit", "--no-fund"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "build"]);
  console.log("consumer smoke: ok");
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}
