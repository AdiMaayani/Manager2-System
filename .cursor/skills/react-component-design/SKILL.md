---
name: react-component-design
description: >-
  Design, split, and style ManageR2 React components using the component-folder
  pattern, BEM CSS, and composition principles. Use when creating new
  components, deciding whether to extract a shared component, writing props
  interfaces, or structuring CSS for a feature.
---

# ManageR2 React Component Design

## Component folder — always

Every non-trivial component is a folder:

```
ComponentName/
  ComponentName.tsx    ← single default concern
  ComponentName.css    ← scoped styles only
  index.ts             ← re-export: export { ComponentName } from './ComponentName';
```

`index.ts` must contain only the re-export. No logic, no hooks.

## When to split into a new component

Extract a new component when **any one** of these is true:

1. The JSX block is used in 2+ places.
2. The block manages its own local state (open/closed, selected tab, etc.).
3. The block is visually a distinct "card", "row", "panel", or "section" with its own CSS.
4. The parent file exceeds ~150 lines of JSX.

**Examples of splits from existing vanilla pages:**

| Vanilla element | React component |
|---|---|
| Project table row | `ProjectRow/` |
| Status badge | `StatusBadge/` |
| Drawer tab strip | `TabBar/` |
| Milestone list item | `MilestoneItem/` |
| Work plan Gantt bar | `GanttBar/` |

## Feature vs shared

Put in `shared/components/` when:
- The component has no domain knowledge (doesn't import from a feature).
- Used by 2+ features (or likely to be).
- Examples: `Button`, `Modal`, `Drawer`, `Tabs`, `Table`, `Badge`, `Spinner`, `PageSpinner`, `ErrorState`, `EmptyState`, `Avatar`.

Put in `features/<domain>/components/` when:
- The component depends on a domain type or API.
- Examples: `ProjectDrawer`, `WorkPlanGantt`, `EmployeeBadge`.

## Props design

```tsx
// ✅ explicit interface, no any
interface ProjectRowProps {
  project: ProjectListItem;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

// ❌ avoid flags that switch behavior
interface BadProps {
  mode: 'view' | 'edit' | 'create';  // split into 3 components instead
}
```

- Prefer composition over boolean flags that drastically change a component's shape.
- Callbacks named `on<Event>`: `onSave`, `onClose`, `onSelect`.
- Booleans prefixed `is`, `has`, `can`: `isOpen`, `hasError`, `canEdit`.

## CSS naming — camelCase BEM

```css
/* Block */
.projectDrawer { }

/* Element */
.projectDrawer__header { }
.projectDrawer__body { }
.projectDrawer__footer { }

/* Modifier */
.projectDrawer--open { }
.projectDrawer--loading { }
```

Rules:
- Block = component name in camelCase.
- Only use tokens (`var(--color-*, --spacing-*, --radius-*, …)`); no magic numbers.
- No global selectors inside a component CSS file.
- RTL: let `dir="rtl"` handle reading direction; use logical properties (`margin-inline-start`) for directional spacing when needed.

## Loading and error states — required

Every component that loads async data must handle all three states:

```tsx
const { data, isLoading, error } = useProjects();
if (isLoading) return <PageSpinner />;
if (error)     return <ErrorState message={error.message} onRetry={refetch} />;
return <ProjectsTable rows={data} />;
```

Never render partially-loaded UI without a guard.

## Composition example

```
features/projects/components/
  ProjectsTable/         ← renders rows, owns column headers
    ProjectsTable.tsx
    ProjectsTable.css
    index.ts
  ProjectRow/            ← single row, owns status badge and click
    ProjectRow.tsx
    ProjectRow.css
    index.ts
  ProjectDrawer/         ← slide-out detail panel
    ProjectDrawer.tsx
    ProjectDrawer.css
    index.ts
    components/          ← drawer-internal sub-components
      DrawerTabBar/
      DrawerOverviewTab/
      DrawerMilestonesTab/
```
