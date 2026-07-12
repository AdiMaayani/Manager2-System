# ManageR2 Agent Instructions

## Source of truth

- Inspect the CURRENT repository before modifying code.

* Plans under `.cursor/plans/` are task-specific. A completed plan is historical reference only unless the current user request explicitly names it as active.
* For every new task, inspect the CURRENT local repository and create or use a task-specific plan for the current branch.
* Never continue, update, or execute a completed historical plan as the active plan for a different task.
* The current local repository workspace is the source of truth. If a prompt, previous conversation, PR description, uploaded snapshot, or historical plan conflicts with the current repository, the current repository wins.

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

Agents may run read-only Git commands, including:

- `git status`
- `git diff`
- `git log`
- `git show`
- `git branch --show-current`
- `git ls-files`
- `git check-ignore`

Agents may run `git add` and `git commit` only when the user explicitly requests Git staging or commit creation in the current conversation.

Before every commit, the agent must:

1. Confirm the current branch.
2. Inspect `git diff --cached`.
3. Verify that only the intended files and hunks are staged.
4. Verify that no secrets, generated files, unrelated changes, or prohibited provider/migration code are staged.
5. Use small, atomic commits.
6. Preserve unrelated local changes.

Unless the user explicitly authorizes the specific operation in the current conversation, agents must not run:

- `git push`
- `git pull`
- `git fetch`
- `git merge`
- `git rebase`
- `git switch`
- `git checkout`
- `git reset`
- `git restore`
- `git clean`
- `git stash`
- `git tag`
- `git cherry-pick`
- commit amendment
- branch creation or deletion
- force operations

Agents must never bypass hooks or use `--force` or `--no-verify` without explicit user authorization.
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
