# PBUI developer documentation

Start here when building or refactoring a PBUI-family interface. The guides below describe the current contract; ticket design documents explain historical decisions, not necessarily today's API.

## Visual onboarding

1. [Visual style](guides/visual-style.md): visual roles, component selection, state and accessibility.
2. [First styled workbench panel](guides/first-styled-workbench-panel.md): the compiled example and its native-shell story.
3. [Styling contract](reference/styling-contract.md): imports, tokens, modules, parts and editor integration.
4. [Visual review and Storybook](playbooks/visual-review-and-storybook.md): bounded hosts, fixture states and evidence.

## Application work

- [New application](playbooks/building-a-new-hyperslop-systems-app-on-pbui.md): ownership, current bootstrap, backend boundaries and delivery.
- [Existing application refactor](playbooks/refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md): incremental adoption and review.
- [Durable editing](playbooks/adding-editing-support-to-a-pbui-application.md): Datalab/Datadrop's domain persistence integration, not a universal Redux requirement.
- [Datalab-specific conventions](../packages/datalab-ui/GUIDELINES.md): package-local layers and tests.

## Policy ownership

The styling contract owns shared visual policy. Package guides document stricter local rules and domain-specific exceptions. Runtime props and compiled examples take precedence over historical prose; fix the prose when they disagree. Do not copy a ticket's proposed API without checking its implemented counterpart.

Reusable components with meaningful states have colocated stories and local styles. Small private/pass-through components may remain local files where the package allows it. Core and workbench have stricter component-folder tests; follow them rather than weakening them for an example. No empty CSS files or generic style-prop API are required.
