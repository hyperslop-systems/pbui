import { execFileSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(dirname(packageRoot));
const smokeRoot = await mkdtemp(join(tmpdir(), "datalab-ui-consumer-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(smokeRoot, ".npm-cache"),
  npm_config_registry: "https://registry.npmjs.org",
};

function run(command, args, cwd = smokeRoot) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: npmEnvironment,
  });
}

async function pack(root, prefix) {
  run("pnpm", ["pack", "--pack-destination", smokeRoot], root);
  const matches = (await readdir(smokeRoot)).filter(
    (name) => name.startsWith(prefix) && name.endsWith(".tgz"),
  );
  if (matches.length !== 1) {
    throw new Error(`expected one ${prefix} tarball, found ${matches.length}`);
  }
  return join(smokeRoot, matches[0]);
}

try {
  const pbuiTarball = await pack(workspaceRoot, "hyperslop-systems-pbui-");
  const protocolTarball = await pack(
    join(workspaceRoot, "packages", "workbench-protocol"),
    "hyperslop-systems-workbench-protocol-",
  );
  const coreTarball = await pack(
    join(workspaceRoot, "packages", "workbench-core"),
    "hyperslop-systems-workbench-core-",
  );
  const shellTarball = await pack(
    join(workspaceRoot, "packages", "pbui-workbench"),
    "hyperslop-systems-pbui-workbench-",
  );
  const plotRoot = join(packageRoot, "node_modules", "@hyperslop-systems", "plot");
  const plotTarball = await pack(plotRoot, "hyperslop-systems-plot-");
  const datalabTarball = await pack(packageRoot, "hyperslop-systems-datalab-ui-");

  await writeFile(
    join(smokeRoot, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: {
          typecheck: "tsc --noEmit",
          build: "vite build",
        },
        dependencies: {
          "@hyperslop-systems/datalab-ui": `file:${datalabTarball}`,
          "@hyperslop-systems/pbui": `file:${pbuiTarball}`,
          "@hyperslop-systems/pbui-workbench": `file:${shellTarball}`,
          "@hyperslop-systems/plot": `file:${plotTarball}`,
          "@hyperslop-systems/workbench-core": `file:${coreTarball}`,
          "@hyperslop-systems/workbench-protocol": `file:${protocolTarball}`,
          react: "^19.2.8",
          "react-dom": "^19.2.8",
        },
        devDependencies: {
          "@types/node": "^24.10.13",
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
          types: ["node", "vite/client"],
        },
        include: ["src", "vite.config.ts"],
      },
      null,
      2,
    ),
  );

  await writeFile(
    join(smokeRoot, "vite.config.ts"),
    `
import { accessSync } from "node:fs";
import { defineConfig } from "vite";
import { datalabPublicDir } from "@hyperslop-systems/datalab-ui/vite";

accessSync(datalabPublicDir);

export default defineConfig({
  publicDir: datalabPublicDir,
});
`,
  );

  await writeFile(
    join(smokeRoot, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
  );
  await mkdir(join(smokeRoot, "src"));
  await writeFile(
    join(smokeRoot, "src", "main.tsx"),
    `
import { createRoot } from "react-dom/client";
import {
  DatalabApp,
  WorkbenchInstance,
  routeFor,
  type DatalabAppProps,
  type InstanceConfig,
  type Route,
} from "@hyperslop-systems/datalab-ui";
import "@hyperslop-systems/datalab-ui/styles.css";

const embedded: InstanceConfig = {
  seed: true,
  persistKey: null,
  masthead: false,
  fullFrame: false,
};
const app: DatalabAppProps = { pathname: "/", strict: false };
const route: Route = routeFor("/ui/");
if (route.kind !== "product") throw new Error("product route contract changed");

function Consumer() {
  return (
    <>
      <DatalabApp {...app} />
      <WorkbenchInstance config={embedded} />
      <WorkbenchInstance config={{ ...embedded, seed: false }} />
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing root");
createRoot(root).render(<Consumer />);
`,
  );

  run("npm", ["install", "--no-audit", "--no-fund"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "build"]);

  const installedDatalab = JSON.parse(
    await readFile(
      join(smokeRoot, "node_modules", "@hyperslop-systems", "datalab-ui", "package.json"),
      "utf8",
    ),
  );
  if (installedDatalab.name !== "@hyperslop-systems/datalab-ui") {
    throw new Error(`unexpected installed package ${installedDatalab.name}`);
  }
  // Expected ranges follow the workspace packages. Packing every private
  // runtime dependency above makes this smoke independent of registry auth
  // and unpublished workspace versions; checking all rewritten ranges catches
  // a tarball that still contains a workspace: specifier or a stale version.
  for (const [name, packageJSON] of [
    ["@hyperslop-systems/pbui", join(workspaceRoot, "package.json")],
    [
      "@hyperslop-systems/pbui-workbench",
      join(workspaceRoot, "packages", "pbui-workbench", "package.json"),
    ],
    [
      "@hyperslop-systems/workbench-core",
      join(workspaceRoot, "packages", "workbench-core", "package.json"),
    ],
    [
      "@hyperslop-systems/workbench-protocol",
      join(workspaceRoot, "packages", "workbench-protocol", "package.json"),
    ],
  ]) {
    const version = JSON.parse(await readFile(packageJSON, "utf8")).version;
    if (installedDatalab.dependencies[name] !== `^${version}`) {
      throw new Error(
        `workspace dependency ${name} was not rewritten to ^${version}: ${installedDatalab.dependencies[name]}`,
      );
    }
  }
  const plotVersion = JSON.parse(await readFile(join(plotRoot, "package.json"), "utf8")).version;
  if (installedDatalab.dependencies["@hyperslop-systems/plot"] !== plotVersion) {
    throw new Error(
      `plot dependency changed from ${plotVersion}: ${installedDatalab.dependencies["@hyperslop-systems/plot"]}`,
    );
  }

  const installedRoot = join(smokeRoot, "node_modules", "@hyperslop-systems", "datalab-ui");
  await access(join(installedRoot, "dist", "datalab.css"));
  await access(join(installedRoot, "public", "icon.svg"));
  await access(join(installedRoot, "public", "contracts", "envelope-projection.json"));

  const packageCss = await readFile(join(installedRoot, "dist", "datalab.css"), "utf8");
  for (const contractMarker of [
    "--pbui-font",
    "[data-part=presentation]",
    "[data-pbui-component=dialog]",
    // The object menu positions itself entirely from this stylesheet; shipping
    // without it produced a menu that rendered unpositioned at the end of the
    // document, invisible, with every mechanical check still passing.
    "[data-part=menu]",
    // The tile chrome and its drop-zone preview (PBUI-UNIFY-001).
    "[data-part=tile-bar]",
  ]) {
    if (!packageCss.includes(contractMarker)) {
      throw new Error(`Datalab stylesheet omitted bundled PBUI contract ${contractMarker}`);
    }
  }

  if (!installedDatalab.sideEffects.includes("./dist/index.js")) {
    throw new Error("Datalab package does not preserve application-registration side effects");
  }

  const libraryJavaScript = await readFile(join(installedRoot, "dist", "index.js"), "utf8");
  for (const appId of ["launcher", "chart", "signin", "upload", "templates"]) {
    if (!new RegExp(`id:\\s*"${appId}"`).test(libraryJavaScript)) {
      throw new Error(`Datalab library omitted application registration ${appId}`);
    }
  }

  const worldDeclaration = await readFile(
    join(installedRoot, "dist", "store", "world.d.ts"),
    "utf8",
  );
  if (worldDeclaration.includes("worldSlice") || worldDeclaration.includes("worldActions")) {
    throw new Error("internal Redux implementation leaked into declaration output");
  }

  try {
    await access(join(installedRoot, "dist", "duckdb-extensions"));
    throw new Error("package duplicated public DuckDB extensions under dist/");
  } catch (error) {
    if (error instanceof Error && !("code" in error)) throw error;
  }

  const reactPackage = await readFile(join(smokeRoot, "node_modules", "react", "package.json"));
  const nestedReact = join(
    smokeRoot,
    "node_modules",
    "@hyperslop-systems",
    "datalab-ui",
    "node_modules",
    "react",
  );
  await access(join(smokeRoot, "dist", "index.html"));
  try {
    await access(nestedReact);
    throw new Error("Datalab UI installed a second nested React runtime");
  } catch (error) {
    if (error instanceof Error && !("code" in error)) throw error;
  }

  console.log(`Datalab UI consumer smoke passed with React ${JSON.parse(reactPackage).version}`);
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}
