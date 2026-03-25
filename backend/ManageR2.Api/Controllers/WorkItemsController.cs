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