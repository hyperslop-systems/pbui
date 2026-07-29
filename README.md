# `@hyperslop-systems/pbui`

PBUI is a domain-neutral React library for presenting typed objects and
exposing descriptor-defined actions. Applications own their value vocabulary,
environment, verbs, state management, and effects.

```tsx
const registry = createPresentationRegistry<Values, Environment, Verb>({
  person: {
    label: (person) => person.name,
    actions: (person) => [{
      id: "email",
      label: "Send email",
      verb: { type: "emailPerson", personId: person.id },
    }],
  },
});

const pbui = createPbui({ registry, defaultEnvironment });

<pbui.Provider onPerform={performVerb}>
  <pbui.Presentation reference={{ type: "person", value: person }} />
  <pbui.ObjectMenu />
</pbui.Provider>
```

The package intentionally does not depend on Redux, RTK Query, Datadrop model
types, or application routing.

## Validate a clean consumer

`pnpm consumer:smoke` builds the package, packs the publishable files into a
tarball, creates a temporary React application, installs that tarball, and
runs strict TypeScript and Vite builds. The smoke imports the root API, the
`presentation` subpath, and both CSS exports; renders two isolated PBUI
instances; exercises descriptor-neutral molecules and organisms; and verifies
that the consumer resolves one React version.

## Publish to GitHub Packages

The manual **Publish PBUI** workflow targets
`https://npm.pkg.github.com` as `@hyperslop-systems/pbui`. It defaults to an
`npm publish --dry-run`, runs typecheck, tests, package build, Storybook, and
the clean-consumer smoke first, and skips an already-published immutable
version by default.

A real publication tagged `latest` additionally requires the operator to enter
`CONFIRM_LATEST`. Never force-overwrite a version; increment `version` in
`package.json` and regenerate the lockfile instead.
