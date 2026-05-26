---
name: backend-feature-organization
description: >-
  Add or reorganize ManageR2 backend code into per-feature folders while
  preserving Clean Architecture layer boundaries. Use when creating a new
  domain feature, adding a controller, repository, service, DTO, or model, or
  when asked about backend folder structure.
---

# ManageR2 Backend Feature Organization

## Folder structure

Each domain lives in parallel `Features/<Domain>/` folders inside the three projects:

```
apps/api/
  ManageR2.Api/
    Features/
      Projects/
        ProjectsController.cs
        DTOs/
          ProjectLifecycleDto.cs
          ProjectListItemDto.cs
  ManageR2.Infrastructure/
    Features/
      Projects/
        Repositories/
          ProjectLifecycleRepository.cs
          IProjectLifecycleRepository.cs
        Services/        ← only if Projects has a service
        Models/
          ProjectLifecycleModel.cs
          ProjectListItemResult.cs
  ManageR2.Domain/
    Features/
      Projects/
        Entities/
          WorkItem.cs    ← the domain entity for projects
```

## Layer boundaries (unchanged)

```
Controller → Service → Repository → SQL Server
```

- Controllers call Services (or Repositories directly if no business logic is needed).
- Services call Repositories; never SQL directly.
- Repositories use ADO.NET + Stored Procedures only; no EF, no inline SQL.
- DTOs belong to `ManageR2.Api`; Models belong to `ManageR2.Infrastructure`.
- Domain Entities belong to `ManageR2.Domain`; they must not reference Api or Infrastructure.

## Namespaces — keep flat

Namespaces are **not** changed by the folder move. Keep existing namespaces:

```csharp
// File: ManageR2.Api/Features/Projects/ProjectsController.cs
namespace ManageR2.Api.Controllers;   // ← unchanged
```

This avoids touching every `using` directive across the solution. Update namespaces only when starting a brand-new file.

## Adding a new domain — checklist

```
Task Progress:
- [ ] Domain entity in ManageR2.Domain/Features/<Domain>/Entities/
- [ ] Interface + implementation in ManageR2.Infrastructure/Features/<Domain>/Repositories/
- [ ] Service interface + implementation in ManageR2.Infrastructure/Features/<Domain>/Services/  (if business logic exists)
- [ ] Models (internal DB result shapes) in ManageR2.Infrastructure/Features/<Domain>/Models/
- [ ] Request/Response DTOs in ManageR2.Api/Features/<Domain>/DTOs/
- [ ] Controller in ManageR2.Api/Features/<Domain>/
- [ ] Register repository and service in ManageR2.Api/Program.cs (DI)
- [ ] Stored procedure created under database/SP/sp_<Domain>_<Action>.sql
```

## Naming in new files

| Kind | Pattern | Example |
|---|---|---|
| Controller | `<Domain>Controller` | `ReportsController` |
| Repository interface | `I<Domain>Repository` | `IWorkItemRepository` |
| Repository implementation | `<Domain>Repository` | `WorkItemRepository` |
| Service interface | `I<Domain>Service` | `ISmartAssignmentService` |
| Service implementation | `<Domain>Service` | `SmartAssignmentService` |
| Request DTO | `<Action><Domain>RequestDto` | `CreateWorkItemRequestDto` |
| Response DTO | `<Domain><Purpose>ResponseDto` | `ProjectLifecycleResponseDto` |
| SP name | `sp_<Domain>_<Action>` | `sp_WorkItems_Create` |

Async method suffix: always end with `Async` (`GetAllAsync`, `CreateWorkItemAsync`).

## Program.cs DI registration

Add new services/repositories in `ManageR2.Api/Program.cs`:

```csharp
builder.Services.AddScoped<IXRepository, XRepository>();
builder.Services.AddScoped<IXService, XService>();
```

Scoped lifetime is the correct default for ADO.NET repository classes.
