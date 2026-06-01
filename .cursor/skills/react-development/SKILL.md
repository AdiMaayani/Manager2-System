---
name: react-development
description: >-
  Build and refactor ManageR2 React UI with feature-based structure, hooks, and
  TypeScript. Use when creating or editing React components, pages, hooks,
  context, routing, forms, or migrating vanilla frontend modules to React.
---

# ManageR2 React Development

## Before coding

1. Read surrounding feature code and match its patterns.
2. Keep changes scoped — no drive-by refactors.
3. Preserve RTL/Hebrew UI (`dir="rtl"`, labels in Hebrew).
4. Do not put business rules in components; mirror backend service boundaries.

## Target layout

React code lives under `apps/web/src/`:

```
apps/web/src/
  main.tsx
  app/                    # router.tsx, App.tsx, ProtectedRoute/
  features/<domain>/      # per-feature (auth, projects, workplan, …)
    components/<Name>/    # component folder
      Name.tsx
      Name.css
      index.ts
    hooks/
    pages/<Page>/
      Page.tsx
      Page.css
      index.ts
    api/                  # <domain>ApiClient.ts
    types.ts
    index.ts              # public exports only
  shared/
    components/<Name>/    # common Button, Spinner, Table, Modal, …
    hooks/
    utils/
  api/                    # client.ts, auth.ts
  styles/                 # tokens.css, base.css, utilities.css
```

Path aliases: `@api/`, `@features/`, `@shared/`, `@styles/`, `@/`.

**Dependency direction:** `app` → `features` → `shared` → `api`. Features must not import other features' internals — use `features/x/index.ts`.

## Component folder rule

Every non-trivial component is a folder:

```
features/projects/components/ProjectDrawer/
  ProjectDrawer.tsx       ← component
  ProjectDrawer.css       ← scoped styles
  index.ts                ← re-export only
```

- One primary export per folder.
- CSS class names use camelCase BEM: `.projectDrawer__header`, `.projectDrawer--open`.
- `index.ts` contains only `export { Foo } from './Foo';` — no logic.

## Component rules

- Functional components only.
- Explicit `interface FooProps` for every component.
- Avoid `any`. Prefer `unknown` and narrow.
- Thin pages: pages call hooks and render; child components handle display.

```tsx
// ✅ Correct: thin page
export function ProjectsPage() {
  const { projects, isLoading, error } = useProjects();
  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorState message={error.message} />;
  return <ProjectsTable rows={projects} />;
}
```

## Splitting heuristics

Extract a new component when:
- A section of JSX is reused in 2+ places, OR
- A section has its own local state, OR
- A section is complex enough to deserve its own file for readability.

Common components that belong in `shared/components/`:
`Button`, `Modal`, `Drawer`, `Tabs`, `Table`, `Badge`, `Spinner`, `PageSpinner`, `ErrorState`, `EmptyState`.

## Hooks

- Prefix `use`; one concern per hook.
- Async hooks return `{ data, isLoading, error, refetch? }`.
- Clean up effects: return a cleanup function from `useEffect`.

## API integration

- All HTTP calls through `@api/client.ts → apiRequest<T>()`.
- Feature-level API functions live in `features/<x>/api/<domain>ApiClient.ts`.
- Functions end with `Async`: `getProjectLifecycleAsync`.
- See `react-api-auth` skill for session/auth patterns.

## Styles

- Import `tokens.css` at the app root only — all others use variables.
- Each component imports its own `.css` file (co-located, same folder).
- RTL layout; do not flip manually — rely on `dir="rtl"` on `<html>`.

## Data mode

Set `VITE_APP_DATA_MODE=local` or `mock` in `apps/web/.env.development`. Feature hooks branch with `isLocalDataMode` and `resolveDataAsync`.

Keep DTO field names aligned with backend (`CreateWorkItemRequestDto` → `CreateWorkItemRequest`).
