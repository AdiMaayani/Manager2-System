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
    public async Task<IActionResult> GetWorkItems()
    {
        var workItems = await _workItemRepository.GetWorkItemsAsync();
        return Ok(workItems);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetWorkItemById(int id)
    {
        var workItem = await _workItemRepository.GetByIdAsync(id);

        if (workItem == null)
        {
            return NotFound();
        }

        return Ok(workItem);
    }

    [HttpGet("type/{workType}")]
    public async Task<IActionResult> GetWorkItemsByType(string workType)
    {
        var workItems = await _workItemRepository.GetByTypeAsync(workType);
        return Ok(workItems);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateWorkItem(int id, [FromBody] WorkItem workItem)
    {
        if (workItem == null)
        {
            return BadRequest("WorkItem body is required.");
        }

        if (id != workItem.WorkItemId)
        {
            return BadRequest("Route id must match WorkItemId.");
        }

        var updated = await _workItemRepository.UpdateAsync(workItem);

        if (!updated)
        {
            return NotFound();
        }

        return Ok(new { message = "Work item updated successfully." });
    }

    [HttpPut("{id}/close")]
    public async Task<IActionResult> CloseWorkItem(int id)
    {
        var closed = await _workItemRepository.CloseAsync(id);

        if (!closed)
        {
            return NotFound();
        }

        return Ok(new { message = "Work item closed successfully." });
    }
}