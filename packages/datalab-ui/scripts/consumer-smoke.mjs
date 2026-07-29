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
  if (installedDatalab.dependencies["@hyperslop-systems/pbui"] !== "^0.1.0") {
    throw new Error(
      `workspace dependency was not rewritten: ${
        installedDatalab.dependencies["@hyperslop-systems/pbui"]
      }`,
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
