using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkItemsController : ControllerBase
{
    private readonly IWorkItemRepository _workItemRepository;

    public WorkItemsController(IWorkItemRepository workItemRepository)
    {
        _workItemRepository = workItemRepository;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkItem>>> GetAll()
    {
        var workItems = await _workItemRepository.GetAllAsync();
        return Ok(workItems);
    }

    [HttpGet("projects-list")]
    public async Task<ActionResult<List<ProjectListItemDto>>> GetProjectsList()
    {
        var projects = await _workItemRepository.GetProjectsListAsync();

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

    [HttpGet("{id}")]
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
    public async Task<ActionResult<List<WorkItem>>> GetByType(string workType)
    {
        var workItems = await _workItemRepository.GetByTypeAsync(workType);
        return Ok(workItems);
    }

    [HttpGet("{id}/tasks")]
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

        var workPlanResult = await _workItemRepository.GetWorkPlanAsync(id);

        if (workPlanResult == null)
        {
            return NotFound($"Project with ID {id} was not found.");
        }

        var response = new WorkPlanDto
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
        };

        return Ok(response);
    }

    [HttpGet("work-plan/all")]
    public async Task<ActionResult<List<WorkPlanDto>>> GetAllWorkPlans()
    {
        var workPlans = await _workItemRepository.GetAllWorkPlansAsync();

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

    [HttpGet("{id}/milestones")]
    public async Task<ActionResult<List<ProjectMilestoneDto>>> GetProjectMilestones(int id)
    {
        var workItem = await _workItemRepository.GetByIdAsync(id);

        if (workItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        if (!string.Equals(workItem.WorkType, "Project", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"Milestones are only available for projects. WorkItem {id} is of type '{workItem.WorkType}'.");
        }

        var milestones = await _workItemRepository.GetProjectMilestonesAsync(id);

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

    [HttpPost]
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

        if (workItem.CustomerId <= 0)
        {
            return BadRequest("CustomerId must be greater than 0.");
        }

        if (workItem.SiteId <= 0)
        {
            return BadRequest("SiteId must be greater than 0.");
        }

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

        return Ok(new
        {
            message = "Work item created successfully.",
            workItemId = newWorkItemId
        });
    }

    [HttpPost("project")]
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

        return Ok(new
        {
            message = "Project created successfully.",
            workItemId = newWorkItemId
        });
    }

    [HttpPost("task")]
    public async Task<IActionResult> CreateTask([FromBody] CreateTaskRequest request)
    {
        if (request == null)
        {
            return BadRequest("Task data is required.");
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

        if (!request.ParentWorkItemId.HasValue || request.ParentWorkItemId.Value <= 0)
        {
            return BadRequest("ParentWorkItemId is required for task creation.");
        }

        var parentWorkItem = await _workItemRepository.GetByIdAsync(request.ParentWorkItemId.Value);
        if (parentWorkItem == null)
        {
            return NotFound($"Parent project with ID {request.ParentWorkItemId.Value} was not found.");
        }

        var task = new WorkItem
        {
            Title = request.Title,
            Description = request.Description,
            WorkType = "Task",
            Status = request.Status,
            BillingType = request.BillingType,
            CustomerId = request.CustomerId,
            SiteId = request.SiteId,
            ParentWorkItemId = request.ParentWorkItemId,
            DealCloseDate = request.DealCloseDate,
            FinanceProjectNumber = request.FinanceProjectNumber,
            InvoiceNumber = request.InvoiceNumber
        };

        var newWorkItemId = await _workItemRepository.CreateAsync(task);

        if (newWorkItemId <= 0)
        {
            return BadRequest("Failed to create task.");
        }

        return Ok(new
        {
            message = "Task created successfully.",
            workItemId = newWorkItemId
        });
    }

    [HttpPut("{id}")]
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

        return Ok(new { message = "Work item updated successfully." });
    }

    [HttpPut("{id}/close")]
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

        return Ok(new { message = "Work item closed successfully." });
    }

    [HttpPost("{id}/assign-employee")]
    public async Task<IActionResult> AssignEmployee(int id, [FromBody] AssignEmployeeRequest request)
    {
        if (request == null || request.EmployeeId <= 0 || string.IsNullOrWhiteSpace(request.AssignmentRole))
        {
            return BadRequest("Valid EmployeeId and AssignmentRole are required.");
        }

        var existingWorkItem = await _workItemRepository.GetByIdAsync(id);
        if (existingWorkItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        var employeeExists = await _workItemRepository.EmployeeExistsAsync(request.EmployeeId);
        if (!employeeExists)
        {
            return NotFound($"Employee with ID {request.EmployeeId} was not found.");
        }

        var assigned = await _workItemRepository.AssignEmployeeToWorkAsync(id, request.EmployeeId, request.AssignmentRole);

        if (!assigned)
        {
            return BadRequest("Failed to assign employee to work item.");
        }

        return Ok(new { message = "Employee assigned successfully." });
    }

    [HttpPost("{id}/assign-contractor")]
    public async Task<IActionResult> AssignContractor(int id, [FromBody] AssignContractorRequest request)
    {
        if (request == null || request.ContractorId <= 0 || string.IsNullOrWhiteSpace(request.AssignmentRole))
        {
            return BadRequest("Valid ContractorId and AssignmentRole are required.");
        }

        var existingWorkItem = await _workItemRepository.GetByIdAsync(id);
        if (existingWorkItem == null)
        {
            return NotFound($"Work item with ID {id} was not found.");
        }

        var contractorExists = await _workItemRepository.ContractorExistsAsync(request.ContractorId);
        if (!contractorExists)
        {
            return NotFound($"Contractor with ID {request.ContractorId} was not found.");
        }

        var assigned = await _workItemRepository.AssignContractorToWorkAsync(id, request.ContractorId, request.AssignmentRole);

        if (!assigned)
        {
            return BadRequest("Failed to assign contractor to work item.");
        }

        return Ok(new { message = "Contractor assigned successfully." });
    }

    [HttpPost("{projectId}/milestones")]
    public async Task<IActionResult> CreateMilestone(int projectId, [FromBody] CreateMilestoneRequest request)
    {
        if (request == null)
        {
            return BadRequest("Milestone data is required.");
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

        if (request.PlannedStart.HasValue && request.PlannedEnd.HasValue)
        {
            if (request.PlannedEnd <= request.PlannedStart)
            {
                return BadRequest("PlannedEnd must be after PlannedStart.");
            }
        }

        if (request.ActualStart.HasValue && request.ActualEnd.HasValue)
        {
            if (request.ActualEnd <= request.ActualStart)
            {
                return BadRequest("ActualEnd must be after ActualStart.");
            }
        }

        // לוודא שהפרויקט קיים
        var project = await _workItemRepository.GetByIdAsync(projectId);
        if (project == null)
        {
            return NotFound($"Project with ID {projectId} was not found.");
        }

        if (!string.Equals(project.WorkType, "Project", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"WorkItem {projectId} is not a project.");
        }

        // יצירת ה־milestone
        var milestone = new WorkItem
        {
            Title = request.Title,
            Description = request.Description,
            WorkType = "Task",
            Status = request.Status,
            BillingType = request.BillingType,
            CustomerId = request.CustomerId,
            SiteId = request.SiteId,
            ParentWorkItemId = projectId,

            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            EstimatedHours = CalculateHours(request.PlannedStart, request.PlannedEnd)
                 ?? request.EstimatedHours,

            ActualStart = request.ActualStart,
            ActualEnd = request.ActualEnd,
            ActualHours = CalculateHours(request.ActualStart, request.ActualEnd)
              ?? request.ActualHours,
            Priority = request.Priority,
            RequiredRole = request.RequiredRole,
            IsLocked = request.IsLocked
        };

        var newMilestoneId = await _workItemRepository.CreateMilestoneAsync(milestone);

        if (newMilestoneId <= 0)
        {
            return BadRequest("Failed to create milestone.");
        }

        // Assign Employees
        if (request.Employees != null && request.Employees.Any())
        {
            foreach (var employee in request.Employees)
            {
                var exists = await _workItemRepository.EmployeeExistsAsync(employee.EmployeeId);
                if (!exists)
                {
                    return NotFound($"Employee with ID {employee.EmployeeId} was not found.");
                }

                await _workItemRepository.AssignEmployeeToWorkAsync(
                    newMilestoneId,
                    employee.EmployeeId,
                    employee.AssignmentRole
                );
            }
        }

        // Assign Contractors
        if (request.Contractors != null && request.Contractors.Any())
        {
            foreach (var contractor in request.Contractors)
            {
                var exists = await _workItemRepository.ContractorExistsAsync(contractor.ContractorId);
                if (!exists)
                {
                    return NotFound($"Contractor with ID {contractor.ContractorId} was not found.");
                }

                await _workItemRepository.AssignContractorToWorkAsync(
                    newMilestoneId,
                    contractor.ContractorId,
                    contractor.AssignmentRole
                );
            }
        }

        return Ok(new
        {
            message = "Milestone created successfully.",
            milestoneId = newMilestoneId
        });
    }

    [HttpPut("milestones/{milestoneId}")]
    public async Task<IActionResult> UpdateMilestone(int milestoneId, [FromBody] UpdateMilestoneRequest request)
    {
        if (request == null)
        {
            return BadRequest("Milestone data is required.");
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

        if (request.PlannedStart.HasValue && request.PlannedEnd.HasValue)
        {
            if (request.PlannedEnd <= request.PlannedStart)
            {
                return BadRequest("PlannedEnd must be after PlannedStart.");
            }
        }

        if (request.ActualStart.HasValue && request.ActualEnd.HasValue)
        {
            if (request.ActualEnd <= request.ActualStart)
            {
                return BadRequest("ActualEnd must be after ActualStart.");
            }
        }

        var existingMilestone = await _workItemRepository.GetByIdAsync(milestoneId);
        if (existingMilestone == null)
        {
            return NotFound($"Milestone with ID {milestoneId} was not found.");
        }

        if (!string.Equals(existingMilestone.WorkType, "Task", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"WorkItem {milestoneId} is not a milestone/task.");
        }

        var milestone = new WorkItem
        {
            Title = request.Title,
            Description = request.Description,
            WorkType = existingMilestone.WorkType,
            Status = request.Status,
            BillingType = request.BillingType,
            CustomerId = request.CustomerId,
            SiteId = request.SiteId,
            ParentWorkItemId = existingMilestone.ParentWorkItemId,
            DealCloseDate = existingMilestone.DealCloseDate,
            FinanceProjectNumber = existingMilestone.FinanceProjectNumber,
            InvoiceNumber = existingMilestone.InvoiceNumber,

            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            EstimatedHours = CalculateHours(request.PlannedStart, request.PlannedEnd)
                 ?? request.EstimatedHours,

            ActualStart = request.ActualStart,
            ActualEnd = request.ActualEnd,
            ActualHours = CalculateHours(request.ActualStart, request.ActualEnd)
              ?? request.ActualHours,

            Priority = request.Priority,
            RequiredRole = request.RequiredRole,
            IsLocked = request.IsLocked
        };

        var updated = await _workItemRepository.UpdateMilestoneAsync(milestoneId, milestone);

        if (!updated)
        {
            return BadRequest("Failed to update milestone.");
        }

        var deletedEmployees = await _workItemRepository.DeleteEmployeeAssignmentsByWorkItemIdAsync(milestoneId);
        if (!deletedEmployees)
        {
            return BadRequest("Failed to reset employee assignments.");
        }

        var deletedContractors = await _workItemRepository.DeleteContractorAssignmentsByWorkItemIdAsync(milestoneId);
        if (!deletedContractors)
        {
            return BadRequest("Failed to reset contractor assignments.");
        }

        if (request.Employees != null && request.Employees.Any())
        {
            foreach (var employee in request.Employees)
            {
                var exists = await _workItemRepository.EmployeeExistsAsync(employee.EmployeeId);
                if (!exists)
                {
                    return NotFound($"Employee with ID {employee.EmployeeId} was not found.");
                }

                await _workItemRepository.AssignEmployeeToWorkAsync(
                    milestoneId,
                    employee.EmployeeId,
                    employee.AssignmentRole
                );
            }
        }

        if (request.Contractors != null && request.Contractors.Any())
        {
            foreach (var contractor in request.Contractors)
            {
                var exists = await _workItemRepository.ContractorExistsAsync(contractor.ContractorId);
                if (!exists)
                {
                    return NotFound($"Contractor with ID {contractor.ContractorId} was not found.");
                }

                await _workItemRepository.AssignContractorToWorkAsync(
                    milestoneId,
                    contractor.ContractorId,
                    contractor.AssignmentRole
                );
            }
        }

        return Ok(new
        {
            message = "Milestone updated successfully."
        });
    }

    [HttpPut("milestones/{milestoneId}/cancel")]
    public async Task<IActionResult> SoftDeleteMilestone(int milestoneId)
    {
        var existingMilestone = await _workItemRepository.GetByIdAsync(milestoneId);

        if (existingMilestone == null)
        {
            return NotFound($"Milestone with ID {milestoneId} was not found.");
        }

        if (!string.Equals(existingMilestone.WorkType, "Task", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"WorkItem {milestoneId} is not a milestone/task.");
        }

        var deleted = await _workItemRepository.SoftDeleteMilestoneAsync(milestoneId);

        if (!deleted)
        {
            return BadRequest("Failed to cancel milestone.");
        }

        return Ok(new
        {
            message = "Milestone cancelled successfully."
        });
    }

    private static decimal? CalculateHours(DateTime? start, DateTime? end)
    {
        if (!start.HasValue || !end.HasValue)
        {
            return null;
        }

        if (end <= start)
        {
            return null;
        }

        var totalHours = (decimal)(end.Value - start.Value).TotalHours;

        return Math.Round(totalHours, 2);
    }
}

