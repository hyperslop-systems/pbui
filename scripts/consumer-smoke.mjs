import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageRoot = process.cwd();
const smokeRoot = await mkdtemp(join(tmpdir(), "pbui-consumer-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(smokeRoot, ".npm-cache"),
  npm_config_registry: "https://registry.npmjs.org",
};

function run(command, args) {
  execFileSync(command, args, {
    cwd: smokeRoot,
    stdio: "inherit",
    env: npmEnvironment,
  });
}

try {
  execFileSync(
    "npm",
    ["pack", packageRoot, "--pack-destination", smokeRoot, "--silent"],
    {
      cwd: packageRoot,
      stdio: "inherit",
      env: npmEnvironment,
    },
  );
  const tarballs = (await readdir(smokeRoot)).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`expected one packed tarball, found ${tarballs.length}`);
  }

  const tarball = join(smokeRoot, tarballs[0]);
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
          "@hyperslop-systems/pbui": `file:${tarball}`,
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

  await writeFile(
    join(smokeRoot, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
  );
  await mkdir(join(smokeRoot, "src"));
  await writeFile(
    join(smokeRoot, "src", "vite-env.d.ts"),
    '/// <reference types="vite/client" />\n',
  );
  await writeFile(
    join(smokeRoot, "src", "main.tsx"),
    `
import { createRoot } from "react-dom/client";
import {
  BackdropPanel,
  Button,
  ResultLog,
  createPbui,
  createPresentationRegistry,
  type ResultLine,
} from "@hyperslop-systems/pbui";
import type { PresentationAction } from "@hyperslop-systems/pbui/presentation";
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui/components.css";

type Values = {
  person: { id: string; name: string };
};
type Environment = { prefix: string };
type Verb = { type: "select"; personId: string };

const registry = createPresentationRegistry<Values, Environment, Verb>({
  person: {
    label: (person, environment) => environment.prefix + person.name,
    actions: (person): readonly PresentationAction<Verb>[] => [{
      id: "select",
      label: "Select",
      verb: { type: "select", personId: person.id },
    }],
  },
});
const first = createPbui({ registry, defaultEnvironment: { prefix: "A: " } });
const second = createPbui({ registry, defaultEnvironment: { prefix: "B: " } });
const person = { id: "p1", name: "Ada" };
const lines: ResultLine<"person">[] = [{
  id: "result-1",
  segments: [{
    kind: "object",
    ptype: "person",
    label: "Ada",
    value: person,
  }],
}];

function App() {
  return (
    <>
      <first.Provider>
        <first.Presentation reference={{ type: "person", value: person }}>
          <Button>First instance</Button>
        </first.Presentation>
      </first.Provider>
      <second.Provider>
        <second.Presentation reference={{ type: "person", value: person }}>
          <Button>Second instance</Button>
        </second.Presentation>
      </second.Provider>
      <ResultLog lines={lines} accessibleName="Results" />
      <BackdropPanel
        width={100}
        height={100}
        backdrop={<rect width="100" height="100" fill="transparent" />}
        // A mark's own label is its VISIBLE text and is deliberately NOT
        // renamed: only each component's aria-only prop became accessibleName.
        marks={[{ id: "mark-1", x: 20, y: 20, r: 5, label: "Ada", value: person }]}
        accessibleName="People map"
        renderMark={(_mark, body) => body}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`,
  );

  run("npm", ["install", "--ignore-scripts"]);
  run("npm", ["run", "typecheck", "--silent"]);
  run("npm", ["run", "build", "--silent"]);

  const dependencyTree = JSON.parse(
    execFileSync("npm", ["ls", "react", "--all", "--json"], {
      cwd: smokeRoot,
      encoding: "utf8",
    }),
  );
  const installedReact = new Set();
  function collectReact(node) {
    const react = node?.dependencies?.react;
    if (react?.version) installedReact.add(react.version);
    for (const dependency of Object.values(node?.dependencies ?? {})) {
      collectReact(dependency);
    }
  }
  collectReact(dependencyTree);
  if (installedReact.size !== 1) {
    throw new Error(`expected one React version, found: ${[...installedReact].join(", ")}`);
  }

  const builtHtml = await readFile(join(smokeRoot, "dist", "index.html"), "utf8");
  if (!builtHtml.includes("/assets/")) {
    throw new Error("Vite consumer build did not emit an asset reference");
  }

  console.log(`clean PBUI consumer smoke passed with React ${[...installedReact][0]}`);
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}
