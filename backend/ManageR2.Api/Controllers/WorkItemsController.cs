using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

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
                EmployeeName = assignment.EmployeeName,
                ContractorName = assignment.ContractorName
            }).ToList()
        };

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
            ParentWorkItemId = null
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
            ParentWorkItemId = request.ParentWorkItemId
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
}

public class CreateProjectRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int SiteId { get; set; }
}

public class CreateTaskRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int SiteId { get; set; }
    public int? ParentWorkItemId { get; set; }
}

public class AssignEmployeeRequest
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

public class AssignContractorRequest
{
    public int ContractorId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}