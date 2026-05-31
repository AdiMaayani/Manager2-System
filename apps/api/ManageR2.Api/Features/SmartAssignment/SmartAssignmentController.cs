using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Batch smart assignment: builds recommendations for a project or explicit work item set (legacy service path).
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SmartAssignmentController : ControllerBase
{
    // Orchestrates recommendation generation, optional persistence of a run, and load balancing summary.
    private readonly ISmartAssignmentService _smartAssignmentService;

    public SmartAssignmentController(ISmartAssignmentService smartAssignmentService)
    {
        _smartAssignmentService = smartAssignmentService;
    }

    // POST: map DTO to service model, run algorithm, map rich service response back to API DTO for the UI.
    [HttpPost("recommend")]
    public async Task<IActionResult> Recommend([FromBody] SmartAssignmentRequestDto request)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Request body is required." });
        }

        var hasProjectId = request.ProjectId.HasValue;
        var hasWorkItemIds = request.WorkItemIds != null && request.WorkItemIds.Count > 0;
        if (!hasProjectId && !hasWorkItemIds)
        {
            return BadRequest(new { message = "Either ProjectId or WorkItemIds must be provided." });
        }

        // Service layer owns planning date, locked-task inclusion, and optional save-run side effects.
        var serviceRequest = new SmartAssignmentRequestModel
        {
            ProjectId = request.ProjectId,
            WorkItemIds = request.WorkItemIds,
            PlanningDate = request.PlanningDate,
            IncludeLockedTasks = request.IncludeLockedTasks,
            SaveRun = request.SaveRun
        };

        var serviceResponse = await _smartAssignmentService.GenerateRecommendationsAsync(serviceRequest);
        // Flatten nested service result into DTO graph (tasks, per-task violations/warnings, employee load).
        var response = new SmartAssignmentResponseDto
        {
            RecommendationRunId = serviceResponse.RecommendationRunId,
            GeneratedAt = serviceResponse.GeneratedAt,
            Summary = new SmartAssignmentSummaryDto
            {
                TotalTasks = serviceResponse.TotalTasks,
                TasksWithRecommendations = serviceResponse.TasksWithRecommendations,
                ViolationsCount = serviceResponse.ViolationsCount,
                WarningsCount = serviceResponse.WarningsCount,
                Message = serviceResponse.Message
            },
            TaskResults = serviceResponse.TaskResults.Select(r => new SmartAssignmentTaskResultDto
            {
                WorkItemId = r.WorkItemId,
                TaskTitle = r.TaskTitle,
                CurrentEmployeeId = r.CurrentEmployeeId,
                CurrentEmployeeName = r.CurrentEmployeeName,
                RecommendedEmployeeId = r.RecommendedEmployeeId,
                RecommendedEmployeeName = r.RecommendedEmployeeName,
                Score = r.Score,
                Violations = r.Violations,
                Warnings = r.Warnings,
                Reasons = r.Reasons
            }).ToList(),
            EmployeeLoad = serviceResponse.EmployeeLoad.Select(l => new SmartAssignmentEmployeeLoadDto
            {
                EmployeeId = l.EmployeeId,
                EmployeeName = l.EmployeeName,
                AssignedHours = l.AssignedHours,
                CapacityHours = l.CapacityHours,
                LoadPercentage = l.LoadPercentage
            }).ToList()
        };

        return Ok(response);
    }
}
