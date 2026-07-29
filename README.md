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
