using ManageR2.Domain.Repositories;
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
}