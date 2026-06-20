# ManageR2 Agent Instructions

## Source of truth

- Inspect the CURRENT repository before modifying code.
- The approved implementation plan is:
  `.cursor/plans/workplan_reports_overhaul_1c463576.plan.md`
- Do not rely on old source snapshots, previous conversations, or assumptions.
- `igroup30_prod.sql` is read-only reference material. Never execute it.

## Architecture

- Backend: ASP.NET Core with thin controllers, typed DTOs, services for business rules, and repositories for persistence.
- Database: SQL Server. Application reads and writes must use stored procedures/functions.
- Do not introduce inline SQL in repositories.
- Frontend: React and TypeScript through the shared API client and existing React Query conventions.
- Preserve RTL and Hebrew UI.
- Avoid unrelated refactoring.

## Git

- Do not run Git commands.
- Do not commit, push, branch, merge, reset, restore, or stash.
- The user performs all Git operations.

## Database safety

- Do not execute migrations or stored procedures unless explicitly instructed.
- Never execute `igroup30_prod.sql`.
- Do not populate or apply `_MilestoneMigrationMap`.
- Milestone migration is diagnostics-only until explicit approval.
- Do not convert existing datetime data automatically.
- Timezone migration is diagnostics-only until explicit approval.
- Do not archive the synthetic Internal customer or site.

## Approved decisions

- Schedulable categories: Regular, Project, ServiceCall.
- ServiceCall is the WorkItem itself.
- Milestones use a dedicated ProjectMilestones table and are not schedulable.
- WorkPlan uses a flat scheduled/unscheduled response.
- Regular tasks have no synthetic project.
- Duration is derived from planned start/end.
- Draft smart assignment never overwrites manual assignment.
- WorkReports.Status remains the business workflow status.
- LifecycleStatus separately controls Draft/Finalized/Reversed and inventory.
- Inventory finalization must be transactional, idempotent, and safe across reports.

## Validation

Backend:

- `dotnet build apps/api/ManageR2.Backend.sln`
- `dotnet test apps/api/ManageR2.Backend.sln`

Frontend:

- `npm --prefix apps/web run lint`
- `npm --prefix apps/web run build`

Run only checks relevant to the current phase. Fix failures introduced by the phase and identify unrelated pre-existing failures.

## Response format

Return only:

1. Behavior implemented.
2. Files changed.
3. Commands executed and results.
4. Failures or blockers.
5. Remaining work for the next phase.

Keep the report concise.

