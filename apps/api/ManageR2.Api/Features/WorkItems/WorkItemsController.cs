using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Audit;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Api.Features.WorkItems.Mapping;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewWorkPlan)]
public class WorkItemsController : ControllerBase
{
    private readonly IWorkItemRepository _workItemRepository;
    private readonly IWorkItemTaskService _workItemTaskService;
    private readonly IAuditLogService _auditLogService;

    public WorkItemsController(
        IWorkItemRepository workItemRepository,
        IWorkItemTaskService workItemTaskService,
        IAuditLogService auditLogService)
    {
        _workItemRepository = workItemRepository;
        _workItemTaskService = workItemTaskService;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    // Returns all work items for management screens.
    public async Task<ActionResult<List<WorkItem>>> GetAll()
    {
        var workItems = await _workItemRepository.GetAllAsync();
        return Ok(workItems);
    }

    [HttpGet("projects-list")]
    // Returns project-focused list data for project tables.
    public async Task<ActionResult<List<ProjectListItemDto>>> GetProjectsList()
    {
        var projects = await _workItemRepository.GetProjectsListAsync();

        // Maps repository result to API DTO used by the frontend list view.
        var result = projects.Select(project => new ProjectListItemDto
        {
            WorkItemId = project.WorkItemId,
            ProjectNumber = $"P-{project.WorkItemId}",
            Title = project.Title,
            CustomerName = project.CustomerName,
            ProjectManagerName = string.IsNullOrWhiteSpace(project.ProjectManagerName)
                ? "-"
                : project.ProjectManagerName,
            Status = string.IsNullOrWhiteSpace(project.Status)
                ? "-"
                : project.Status,
            CreatedAt = project.CreatedAt,
            SiteName = string.IsNullOrWhiteSpace(project.SiteName)
                ? "-"
                : project.SiteName,
            BillingType = string.IsNullOrWhiteSpace(project.BillingType)
                ? "-"
                : project.BillingType,
            DealCloseDate = project.DealCloseDate,
            FinanceProjectNumber = project.FinanceProjectNumber,
            InvoiceNumber = project.InvoiceNumber
        }).ToList();

        return Ok(result);
    }

    [HttpGet("report-targets")]
    public async Task<ActionResult<List<WorkItemReportTargetDto>>> GetReportTargets()
    {
        var tasks = await _workItemRepository.GetByTypeAsync(WorkItemWorkTypes.Task);
        var serviceCalls = await _workItemRepository.GetByTypeAsync(WorkItemWorkTypes.ServiceCall);

        var targets = tasks
            .Where(task => !task.IsArchived &&
                           (task.TaskCategory == WorkItemTaskCategories.Regular ||
                            task.TaskCategory == WorkItemTaskCategories.Project))
            .Select(task => new WorkItemReportTargetDto
            {
                WorkItemId = task.WorkItemId,
                Title = task.Title,
                TaskCategory = task.TaskCategory ?? WorkItemTaskCategories.Regular,
                CustomerId = task.CustomerId,
                SiteId = task.SiteId,
                ProjectId = task.ParentWorkItemId
            })
            .Concat(serviceCalls
                .Where(call => !call.IsArchived)
                .Select(call => new WorkItemReportTargetDto
                {
                    WorkItemId = call.WorkItemId,
                    Title = call.Title,
                    TaskCategory = WorkItemTaskCategories.ServiceCall,
                    CustomerId = call.CustomerId,
                    SiteId = call.SiteId,
                    ProjectId = null
                }))
            .OrderBy(target => target.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Ok(targets);
    }

    [HttpGet("{id}")]
    // Returns one work item by id (can be project, task, milestone, or service call).
    public async Task<ActionResult<WorkItem>> GetById(int id)
    {
        var workItem = await _workItemRepository.GetByIdAsync(id);

        if (workItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        return Ok(workItem);
    }

    [HttpGet("type/{workType}")]
    // Filters work items by type to support type-specific views.
    public async Task<ActionResult<List<WorkItem>>> GetByType(string workType)
    {
        var workItems = await _workItemRepository.GetByTypeAsync(workType);
        return Ok(workItems);
    }

    [HttpGet("{id}/tasks")]
    // Returns child tasks/milestones under a parent work item.
    public async Task<ActionResult<List<WorkItem>>> GetTasksByParentId(int id)
    {
        var parentWorkItem = await _workItemRepository.GetByIdAsync(id);
        if (parentWorkItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        var tasks = await _workItemRepository.GetTasksByParentIdAsync(id);
        return Ok(tasks);
    }

    [HttpGet("work-plan")]
    public async Task<ActionResult<WorkPlanScheduleDto>> GetWorkPlanSchedule(
        [FromQuery] string scope = "company",
        [FromQuery] int? projectId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? taskCategory = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        [FromQuery] bool includeUnscheduled = true)
    {
        var query = new WorkPlanScheduleQuery
        {
            Scope = scope,
            ProjectId = projectId,
            EmployeeId = employeeId,
            Status = status,
            TaskCategory = taskCategory,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            IncludeUnscheduled = includeUnscheduled,
            CurrentUserEmployeeId = GetCurrentEmployeeId()
        };

        var validationError = WorkPlanScheduleQueryValidator.Validate(query);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var schedule = await _workItemRepository.GetWorkPlanScheduleAsync(query);
        return Ok(WorkPlanScheduleDtoFactory.Create(schedule));
    }

    [HttpGet("{id}/work-plan")]
    public async Task<ActionResult<WorkPlanDto>> GetWorkPlan(int id)
    {
        var workItem = await _workItemRepository.GetByIdAsync(id);
        if (workItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        if (!string.Equals(workItem.WorkType, "Project", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"Work plan is only available for projects. WorkItem {id} is of type '{workItem.WorkType}'.");
        }

        var schedule = await _workItemRepository.GetWorkPlanScheduleAsync(new WorkPlanScheduleQuery
        {
            Scope = "project",
            ProjectId = id,
            IncludeUnscheduled = true,
            CurrentUserEmployeeId = GetCurrentEmployeeId()
        });

        return Ok(MapLegacyWorkPlanFromSchedule(workItem, schedule));
    }

    [HttpGet("work-plan/all")]
    // Returns work plans for all projects to support portfolio-level planning views.
    public async Task<ActionResult<List<WorkPlanDto>>> GetAllWorkPlans()
    {
        var workPlans = await _workItemRepository.GetAllWorkPlansAsync();

        // Converts repository results into response DTOs for each project work plan.
        var response = workPlans.Select(workPlanResult => new WorkPlanDto
        {
            Project = new ProjectSummaryDto
            {
                WorkItemId = workPlanResult.Project.WorkItemId,
                Title = workPlanResult.Project.Title ?? string.Empty,
                Description = workPlanResult.Project.Description,
                WorkType = workPlanResult.Project.WorkType ?? string.Empty,
                Status = workPlanResult.Project.Status ?? string.Empty,
                BillingType = workPlanResult.Project.BillingType,
                CustomerId = workPlanResult.Project.CustomerId,
                SiteId = workPlanResult.Project.SiteId,
                CreatedAt = workPlanResult.Project.CreatedAt,
                ClosedAt = workPlanResult.Project.ClosedAt,
                ParentWorkItemId = workPlanResult.Project.ParentWorkItemId
            },
            Tasks = workPlanResult.Tasks.Select(task => new TaskSummaryDto
            {
                WorkItemId = task.WorkItemId,
                Title = task.Title ?? string.Empty,
                Description = task.Description,
                WorkType = task.WorkType ?? string.Empty,
                Status = task.Status ?? string.Empty,
                BillingType = task.BillingType,
                EstimatedHours = task.EstimatedHours,
                Priority = task.Priority,
                PlannedStart = task.PlannedStart,
                PlannedEnd = task.PlannedEnd,
                RequiredRole = task.RequiredRole,
                IsLocked = task.IsLocked,
                CustomerId = task.CustomerId,
                SiteId = task.SiteId,
                CreatedAt = task.CreatedAt,
                ClosedAt = task.ClosedAt,
                ParentWorkItemId = task.ParentWorkItemId
            }).ToList(),
            Assignments = workPlanResult.Assignments.Select(assignment => new WorkAssignmentDto
            {
                WorkItemId = assignment.WorkItemId,
                EmployeeId = assignment.EmployeeId,
                ContractorId = assignment.ContractorId,
                AssignmentType = assignment.AssignmentType,
                AssignmentRole = assignment.AssignmentRole,
                AssignedHours = assignment.AssignedHours,
                IsManualAssignment = assignment.IsManualAssignment,
                EmployeeName = assignment.EmployeeName,
                ContractorName = assignment.ContractorName
            }).ToList()
        }).ToList();

        return Ok(response);
    }

    [HttpGet("internal-context")]
    public IActionResult GetInternalContext()
    {
        return StatusCode(StatusCodes.Status410Gone, new
        {
            message = "The internal-context endpoint is deprecated. Create Regular tasks without a project parent."
        });
    }

    [HttpGet("{id}/milestones")]
    // Returns milestone details and assignment participants for one project.
    public async Task<ActionResult<List<ProjectMilestoneDto>>> GetProjectMilestones(int id)
    {
        var workItem = await _workItemRepository.GetByIdAsync(id);

        if (workItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        // Milestones are modeled as task-type children under a project.
        if (!string.Equals(workItem.WorkType, "Project", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"Milestones are only available for projects. WorkItem {id} is of type '{workItem.WorkType}'.");
        }

        var milestones = await _workItemRepository.GetProjectMilestonesAsync(id);

        // Maps milestone result rows into nested DTOs for employees and contractors.
        var response = milestones.Select(milestone => new ProjectMilestoneDto
        {
            WorkItemId = milestone.WorkItemId,
            Title = milestone.Title,
            Description = milestone.Description,
            WorkType = milestone.WorkType,
            Status = milestone.Status,
            BillingType = milestone.BillingType,
            CustomerId = milestone.CustomerId,
            SiteId = milestone.SiteId,
            CreatedAt = milestone.CreatedAt,
            PlannedStart = milestone.PlannedStart,
            PlannedEnd = milestone.PlannedEnd,
            ClosedAt = milestone.ClosedAt,
            Priority = milestone.Priority,
            EstimatedHours = milestone.EstimatedHours,
            ActualStart = milestone.ActualStart,
            ActualEnd = milestone.ActualEnd,
            ActualHours = milestone.ActualHours,
            RequiredRole = milestone.RequiredRole,
            IsLocked = milestone.IsLocked,
            Employees = milestone.Employees.Select(employee => new ProjectMilestoneEmployeeDto
            {
                EmployeeId = employee.EmployeeId,
                EmployeeName = employee.EmployeeName,
                AssignmentRole = employee.AssignmentRole,
                AssignedHours = employee.AssignedHours,
                IsManualAssignment = employee.IsManualAssignment
            }).ToList(),
            Contractors = milestone.Contractors.Select(contractor => new ProjectMilestoneContractorDto
            {
                ContractorId = contractor.ContractorId,
                ContractorName = contractor.ContractorName,
                AssignmentRole = contractor.AssignmentRole
            }).ToList()
        }).ToList();

        return Ok(response);
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPost]
    // Creates a generic work item. WorkType defines if it is project/task/service call.
    public async Task<IActionResult> Create([FromBody] WorkItem workItem)
    {
        if (workItem == null)
        {
            return BadRequest("Work item data is required.");
        }

        if (string.IsNullOrWhiteSpace(workItem.Title))
        {
            return BadRequest("Title is required.");
        }

        if (string.IsNullOrWhiteSpace(workItem.WorkType))
        {
            return BadRequest("WorkType is required.");
        }

        if (string.IsNullOrWhiteSpace(workItem.Status))
        {
            return BadRequest("Status is required.");
        }

        if (string.IsNullOrWhiteSpace(workItem.BillingType))
        {
            return BadRequest("BillingType is required.");
        }

        if (workItem.CustomerId.HasValue && workItem.CustomerId.Value <= 0)
        {
            return BadRequest("CustomerId must be greater than 0 when supplied.");
        }

        if (workItem.SiteId.HasValue && workItem.SiteId.Value <= 0)
        {
            return BadRequest("SiteId must be greater than 0 when supplied.");
        }

        // Validates hierarchy links so child work items reference an existing parent.
        if (workItem.ParentWorkItemId.HasValue)
        {
            var parentWorkItem = await _workItemRepository.GetByIdAsync(workItem.ParentWorkItemId.Value);
            if (parentWorkItem == null)
            {
                return NotFound($"Parent work item with ID {workItem.ParentWorkItemId.Value} was not found.");
            }
        }

        var newWorkItemId = await _workItemRepository.CreateAsync(workItem);

        if (newWorkItemId <= 0)
        {
            return BadRequest("Failed to create work item.");
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.WorkItemCreated,
            AuditEntityTypes.WorkItem,
            $"Work item '{workItem.Title}' (#{newWorkItemId}, type {workItem.WorkType}) created.",
            entityId: newWorkItemId,
            metadata: new Dictionary<string, object?>
            {
                ["workType"] = workItem.WorkType,
                ["status"] = workItem.Status,
                ["customerId"] = workItem.CustomerId,
                ["siteId"] = workItem.SiteId
            }));

        return Ok(new
        {
            message = "Work item created successfully.",
            workItemId = newWorkItemId
        });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPost("project")]
    // Creates a top-level project work item.
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectRequest request)
    {
        if (request == null)
        {
            return BadRequest("Project data is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest("Title is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest("Status is required.");
        }

        if (string.IsNullOrWhiteSpace(request.BillingType))
        {
            return BadRequest("BillingType is required.");
        }

        if (request.CustomerId <= 0)
        {
            return BadRequest("CustomerId must be greater than 0.");
        }

        if (request.SiteId <= 0)
        {
            return BadRequest("SiteId must be greater than 0.");
        }

        // WorkType is fixed to Project for consistent project classification.
        var project = new WorkItem
        {
            Title = request.Title,
            Description = request.Description,
            WorkType = "Project",
            Status = request.Status,
            BillingType = request.BillingType,
            CustomerId = request.CustomerId,
            SiteId = request.SiteId,
            ParentWorkItemId = null,
            DealCloseDate = request.DealCloseDate,
            FinanceProjectNumber = request.FinanceProjectNumber,
            InvoiceNumber = request.InvoiceNumber
        };

        var newWorkItemId = await _workItemRepository.CreateAsync(project);

        if (newWorkItemId <= 0)
        {
            return BadRequest("Failed to create project.");
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.WorkItemCreated,
            AuditEntityTypes.WorkItem,
            $"Project '{project.Title}' (#{newWorkItemId}) created.",
            entityId: newWorkItemId,
            metadata: new Dictionary<string, object?>
            {
                ["workType"] = project.WorkType,
                ["status"] = project.Status,
                ["customerId"] = project.CustomerId,
                ["siteId"] = project.SiteId
            }));

        return Ok(new
        {
            message = "Project created successfully.",
            workItemId = newWorkItemId
        });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPost("task")]
    public async Task<IActionResult> CreateTask([FromBody] CreateTaskRequest request)
    {
        if (request == null)
        {
            return BadRequest("Task data is required.");
        }

        try
        {
            var (plannedStartUtc, plannedEndUtc) = UtcDateTimeNormalizer.NormalizePlannedRange(
                request.PlannedStart,
                request.PlannedEnd);

            int? resolvedCustomerId = request.CustomerId;
            int? resolvedSiteId = request.SiteId;

            if (request.TaskCategory == WorkItemTaskCategories.Project)
            {
                var parentWorkItem = await _workItemRepository.GetByIdAsync(request.ParentWorkItemId!.Value);
                if (parentWorkItem == null)
                {
                    return NotFound($"Parent project with ID {request.ParentWorkItemId.Value} was not found.");
                }

                if (!string.Equals(parentWorkItem.WorkType, WorkItemWorkTypes.Project, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest($"Parent work item {request.ParentWorkItemId.Value} is not a project.");
                }

                resolvedCustomerId = resolvedCustomerId is > 0 ? resolvedCustomerId : parentWorkItem.CustomerId;
                resolvedSiteId = resolvedSiteId is > 0 ? resolvedSiteId : parentWorkItem.SiteId;
            }

            var validationInput = new WorkItemTaskValidationInput
            {
                TaskCategory = request.TaskCategory,
                ParentWorkItemId = request.ParentWorkItemId,
                MilestoneId = request.MilestoneId,
                CustomerId = resolvedCustomerId,
                SiteId = resolvedSiteId,
                PlannedStartUtc = plannedStartUtc,
                PlannedEndUtc = plannedEndUtc
            };

            _workItemTaskService.ValidateCreateOrUpdate(validationInput);

            var task = _workItemTaskService.ApplyCanonicalFields(new WorkItem
            {
                Title = request.Title,
                Description = request.Description,
                Status = ResolveTaskStatus(request.Status),
                BillingType = request.BillingType,
                Priority = request.Priority,
                RequiredRole = request.RequiredRole,
                DealCloseDate = request.DealCloseDate,
                FinanceProjectNumber = request.FinanceProjectNumber,
                InvoiceNumber = request.InvoiceNumber
            }, validationInput);

            var newWorkItemId = await _workItemRepository.CreateAsync(task);
            if (newWorkItemId <= 0)
            {
                return BadRequest("Failed to create task.");
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.WorkItemCreated,
                AuditEntityTypes.WorkItem,
                $"Task '{task.Title}' (#{newWorkItemId}, {task.TaskCategory}) created.",
                entityId: newWorkItemId,
                metadata: new Dictionary<string, object?>
                {
                    ["workType"] = task.WorkType,
                    ["taskCategory"] = task.TaskCategory,
                    ["status"] = task.Status,
                    ["parentWorkItemId"] = task.ParentWorkItemId
                }));

            return Ok(new
            {
                message = "Task created successfully.",
                workItemId = newWorkItemId
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPut("task/{taskId:int}")]
    public async Task<IActionResult> UpdateTask(int taskId, [FromBody] UpdateTaskRequest request)
    {
        if (request == null)
        {
            return BadRequest("Task data is required.");
        }

        var existingTask = await _workItemRepository.GetByIdAsync(taskId);
        if (existingTask == null)
        {
            return NotFound($"Task with ID {taskId} was not found.");
        }

        if (existingTask.IsArchived ||
            string.Equals(existingTask.WorkType, WorkItemWorkTypes.ServiceCall, StringComparison.Ordinal))
        {
            return BadRequest("Only Regular and Project tasks can be updated through this endpoint.");
        }

        try
        {
            var (plannedStartUtc, plannedEndUtc) = UtcDateTimeNormalizer.NormalizePlannedRange(
                request.PlannedStart,
                request.PlannedEnd);

            var validationInput = new WorkItemTaskValidationInput
            {
                TaskCategory = request.TaskCategory,
                ParentWorkItemId = request.ParentWorkItemId,
                MilestoneId = request.MilestoneId,
                CustomerId = request.CustomerId,
                SiteId = request.SiteId,
                PlannedStartUtc = plannedStartUtc,
                PlannedEndUtc = plannedEndUtc
            };

            _workItemTaskService.ValidateCreateOrUpdate(validationInput);

            var task = _workItemTaskService.ApplyCanonicalFields(new WorkItem
            {
                Title = request.Title,
                Description = request.Description,
                Status = ResolveTaskStatus(request.Status, existingTask.Status),
                BillingType = request.BillingType,
                Priority = request.Priority,
                RequiredRole = request.RequiredRole,
                IsLocked = request.IsLocked,
                DealCloseDate = request.DealCloseDate,
                FinanceProjectNumber = request.FinanceProjectNumber,
                InvoiceNumber = request.InvoiceNumber
            }, validationInput);

            var updated = await _workItemRepository.UpdateAsync(taskId, task);
            if (!updated)
            {
                return BadRequest("Failed to update task.");
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.WorkItemUpdated,
                AuditEntityTypes.WorkItem,
                $"Task #{taskId} ('{existingTask.Title}') updated.",
                entityId: taskId,
                metadata: new Dictionary<string, object?>
                {
                    ["taskCategory"] = task.TaskCategory,
                    ["status"] = task.Status
                }));

            return Ok(new { message = "Task updated successfully." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPut("{id}")]
    // Updates core fields of an existing work item.
    public async Task<IActionResult> Update(int id, [FromBody] WorkItem workItem)
    {
        if (workItem == null)
        {
            return BadRequest("Work item data is required.");
        }

        var existingWorkItem = await _workItemRepository.GetByIdAsync(id);
        if (existingWorkItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        var updated = await _workItemRepository.UpdateAsync(id, workItem);

        if (!updated)
        {
            return BadRequest("Failed to update work item.");
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.WorkItemUpdated,
            AuditEntityTypes.WorkItem,
            $"Work item #{id} ('{existingWorkItem.Title}') updated.",
            entityId: id,
            metadata: new Dictionary<string, object?>
            {
                ["workType"] = existingWorkItem.WorkType,
                ["status"] = workItem.Status
            }));

        return Ok(new { message = "Work item updated successfully." });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpDelete("tasks/{taskId:int}")]
    public async Task<IActionResult> DeleteTask(int taskId)
    {
        var existingWorkItem = await _workItemRepository.GetByIdAsync(taskId);
        if (existingWorkItem == null)
        {
            return NotFound(new { message = "המשימה לא נמצאה." });
        }

        var result = await _workItemRepository.DeleteWorkPlanTaskAsync(taskId);

        if (result.WasDeleted)
        {
            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.WorkItemDeleted,
                AuditEntityTypes.WorkItem,
                $"Task '{existingWorkItem.Title}' (#{taskId}) deleted.",
                entityId: taskId,
                metadata: new Dictionary<string, object?>
                {
                    ["workType"] = existingWorkItem.WorkType,
                    ["parentWorkItemId"] = existingWorkItem.ParentWorkItemId
                }));

            return NoContent();
        }

        if (result.ResultCode == DeleteWorkPlanTaskResultCode.NotFound)
        {
            return NotFound(new { message = result.Message });
        }

        return BadRequest(new
        {
            message = result.Message,
            code = result.ResultCode.ToString()
        });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPut("{id}/close")]
    // Soft-closes a work item by status/date handling in the repository and DB layer.
    public async Task<IActionResult> Close(int id)
    {
        var existingWorkItem = await _workItemRepository.GetByIdAsync(id);
        if (existingWorkItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        var closed = await _workItemRepository.CloseAsync(id);

        if (!closed)
        {
            return BadRequest("Failed to close work item.");
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.WorkItemClosed,
            AuditEntityTypes.WorkItem,
            $"Work item #{id} ('{existingWorkItem.Title}') closed.",
            entityId: id,
            metadata: new Dictionary<string, object?>
            {
                ["workType"] = existingWorkItem.WorkType
            }));

        return Ok(new { message = "Work item closed successfully." });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPost("{id}/assign-employee")]
    // Links an employee to a work item through assignment records.
    public async Task<IActionResult> AssignEmployee(int id, [FromBody] AssignEmployeeRequest request)
    {
        if (request == null || request.EmployeeId <= 0 || string.IsNullOrWhiteSpace(request.AssignmentRole))
        {
            return BadRequest("Valid EmployeeId and AssignmentRole are required.");
        }

        try
        {
            var assigned = await _workItemRepository.AssignEmployeeToWorkAsync(id, request.EmployeeId, request.AssignmentRole);

            if (!assigned)
            {
                return BadRequest(new { message = "Failed to assign employee to work item." });
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.WorkItemAssigned,
                AuditEntityTypes.WorkItem,
                $"Employee #{request.EmployeeId} assigned to work item #{id}.",
                entityId: id,
                metadata: new Dictionary<string, object?>
                {
                    ["employeeId"] = request.EmployeeId,
                    ["assignmentRole"] = request.AssignmentRole
                }));

            return Ok(new { message = "Employee assigned successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPut("{projectId}/employee-assignments")]
    // Replaces project-level employee assignments without touching child task assignments or contractors.
    public async Task<IActionResult> SyncProjectEmployeeAssignments(int projectId, [FromBody] SyncEmployeeAssignmentsRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Assignment data is required." });
        }

        var project = await _workItemRepository.GetByIdAsync(projectId);
        if (project == null)
        {
            return NotFound(new { message = $"Project with ID {projectId} was not found." });
        }

        if (!string.Equals(project.WorkType, "Project", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"WorkItem {projectId} is not a project." });
        }

        if (request.Employees == null)
        {
            return BadRequest(new { message = "Employees collection is required." });
        }

        var seenEmployeeIds = new HashSet<int>();
        var normalizedAssignments = new List<(int EmployeeId, string AssignmentRole)>();

        foreach (var employee in request.Employees)
        {
            if (employee.EmployeeId <= 0)
            {
                return BadRequest(new { message = "EmployeeId must be greater than 0." });
            }

            if (string.IsNullOrWhiteSpace(employee.AssignmentRole))
            {
                return BadRequest(new { message = "AssignmentRole is required." });
            }

            if (!seenEmployeeIds.Add(employee.EmployeeId))
            {
                return BadRequest(new { message = "Duplicate employee assignments are not allowed." });
            }

            normalizedAssignments.Add((employee.EmployeeId, employee.AssignmentRole.Trim()));
        }

        try
        {
            var synced = await _workItemRepository.SyncEmployeeAssignmentsByWorkItemIdAsync(
                projectId,
                normalizedAssignments);

            if (!synced)
            {
                return BadRequest(new { message = "Failed to sync project employee assignments." });
            }

            return Ok(new { message = "Project employee assignments synced successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPost("{id}/assign-contractor")]
    // Links a contractor to a work item through assignment records.
    public async Task<IActionResult> AssignContractor(int id, [FromBody] AssignContractorRequest request)
    {
        if (request == null || request.ContractorId <= 0 || string.IsNullOrWhiteSpace(request.AssignmentRole))
        {
            return BadRequest("Valid ContractorId and AssignmentRole are required.");
        }

        try
        {
            var assigned = await _workItemRepository.AssignContractorToWorkAsync(id, request.ContractorId, request.AssignmentRole);

            if (!assigned)
            {
                return BadRequest(new { message = "Failed to assign contractor to work item." });
            }

            return Ok(new { message = "Contractor assigned successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPost("{projectId}/milestones")]
    public IActionResult CreateMilestone(int projectId, [FromBody] CreateMilestoneRequest request)
    {
        return StatusCode(StatusCodes.Status410Gone, new
        {
            message = "Milestone-as-work-item creation is deprecated. Use POST /api/projects/{projectId}/milestones."
        });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPut("milestones/{milestoneId}")]
    public IActionResult UpdateMilestone(int milestoneId, [FromBody] UpdateMilestoneRequest request)
    {
        return StatusCode(StatusCodes.Status410Gone, new
        {
            message = "Milestone-as-work-item updates are deprecated. Use PUT /api/projects/{projectId}/milestones/{milestoneId}."
        });
    }

    [Authorize(Policy = Policies.CanManageWorkPlan)]
    [HttpPut("milestones/{milestoneId}/cancel")]
    public IActionResult SoftDeleteMilestone(int milestoneId)
    {
        return StatusCode(StatusCodes.Status410Gone, new
        {
            message = "Milestone-as-work-item cancellation is deprecated. Use PUT /api/projects/{projectId}/milestones/{milestoneId}/deactivate."
        });
    }

    private static string ResolveTaskStatus(string? requestedStatus, string? existingStatus = null) =>
        string.IsNullOrWhiteSpace(requestedStatus)
            ? (existingStatus ?? WorkItemDefaultStatuses.Planned)
            : requestedStatus;

    private int? GetCurrentEmployeeId()
    {
        return int.TryParse(User.FindFirst("employeeId")?.Value, out var employeeId) && employeeId > 0
            ? employeeId
            : null;
    }

    private static WorkPlanDto MapLegacyWorkPlanFromSchedule(WorkItem project, WorkPlanScheduleResult schedule)
    {
        var projectTasks = schedule.ScheduledTasks
            .Concat(schedule.UnscheduledTasks)
            .Where(task => string.Equals(task.TaskCategory, WorkItemTaskCategories.Project, StringComparison.Ordinal))
            .ToList();

        return new WorkPlanDto
        {
            Project = new ProjectSummaryDto
            {
                WorkItemId = project.WorkItemId,
                Title = project.Title ?? string.Empty,
                Description = project.Description,
                WorkType = project.WorkType ?? string.Empty,
                Status = project.Status ?? string.Empty,
                BillingType = project.BillingType,
                CustomerId = project.CustomerId,
                SiteId = project.SiteId,
                CreatedAt = project.CreatedAt,
                ClosedAt = project.ClosedAt,
                ParentWorkItemId = project.ParentWorkItemId
            },
            Tasks = projectTasks.Select(task => new TaskSummaryDto
            {
                WorkItemId = task.WorkItemId,
                Title = task.Title,
                Description = task.Description,
                WorkType = task.WorkType ?? string.Empty,
                Status = task.Status ?? string.Empty,
                EstimatedHours = task.EstimatedHours,
                Priority = task.Priority,
                PlannedStart = task.PlannedStart,
                PlannedEnd = task.PlannedEnd,
                IsLocked = task.IsLocked,
                CustomerId = task.CustomerId,
                SiteId = task.SiteId,
                ParentWorkItemId = task.ProjectId
            }).ToList(),
            Assignments = schedule.Assignments.Select(assignment => new WorkAssignmentDto
            {
                WorkItemId = assignment.WorkItemId,
                EmployeeId = assignment.EmployeeId,
                AssignmentType = assignment.AssignmentType,
                AssignmentRole = assignment.AssignmentRole,
                AssignedHours = assignment.AssignedHours,
                IsManualAssignment = assignment.IsManualAssignment,
                EmployeeName = assignment.EmployeeName
            }).ToList()
        };
    }
}

