using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Services;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Smart assignment: batch recommendations for a project/work-item set (with optional persistence) and a
// draft recommendation for the New Task flow. Restricted to roles that manage the work plan.
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanManageWorkPlan)]
public class SmartAssignmentController : ControllerBase
{
    // Orchestrates recommendation generation, optional persistence of a run, and load balancing summary.
    private readonly ISmartAssignmentService _smartAssignmentService;
    // Per-task / draft ranked recommendations with explainability.
    private readonly IAdvancedSmartAssignmentService _advancedSmartAssignmentService;

    public SmartAssignmentController(
        ISmartAssignmentService smartAssignmentService,
        IAdvancedSmartAssignmentService advancedSmartAssignmentService)
    {
        _smartAssignmentService = smartAssignmentService;
        _advancedSmartAssignmentService = advancedSmartAssignmentService;
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
            SaveRun = request.SaveRun,
            RequestedByUserId = GetCurrentUserId()
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
                Reasons = r.Reasons,
                Factors = r.Factors.Select(MapFactor).ToList()
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

    // POST: ranked recommendations for a NOT-YET-SAVED (draft) task, scored against the draft's own
    // context (project/date/duration/site) rather than unrelated existing project tasks. Preview only —
    // nothing is persisted because there is no task id yet.
    [HttpPost("recommend-draft")]
    public async Task<IActionResult> RecommendDraft([FromBody] DraftTaskRecommendationRequestDto request)
    {
        if (request == null || request.ProjectId <= 0)
        {
            return BadRequest(new { message = "ProjectId is required." });
        }

        if (request.PlannedEnd <= request.PlannedStart)
        {
            return BadRequest(new { message = "PlannedEnd must be after PlannedStart." });
        }

        var context = new DraftTaskRecommendationContextModel
        {
            ProjectId = request.ProjectId,
            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            EstimatedHours = request.EstimatedHours,
            Priority = request.Priority,
            RequiredRole = request.RequiredRole,
            SiteId = request.SiteId
        };

        var candidates = await _advancedSmartAssignmentService.GetRecommendationsForDraftAsync(context);

        var response = new DraftTaskRecommendationResponseDto
        {
            GeneratedAt = DateTime.UtcNow,
            Message = candidates.Count == 0
                ? "לא נמצאו עובדים מתאימים עבור הקשר המשימה."
                : "המלצות שיבוץ חכם חושבו עבור המשימה החדשה.",
            Candidates = candidates.Select(MapCandidate).ToList()
        };

        return Ok(response);
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return int.TryParse(claim, out var userId) ? userId : null;
    }

    private static RecommendationFactorDto MapFactor(RecommendationFactorModel factor)
    {
        return new RecommendationFactorDto
        {
            Key = factor.Key,
            Label = factor.Label,
            Score = factor.Score,
            WeightPercent = factor.WeightPercent,
            Explanation = factor.Explanation,
            DataSource = factor.DataSource,
            HasData = factor.HasData
        };
    }

    private static SmartAssignmentCandidateDto MapCandidate(EmployeeCandidateModel candidate)
    {
        return new SmartAssignmentCandidateDto
        {
            RankOrder = candidate.RankOrder,
            EmployeeId = candidate.EmployeeId,
            FullName = candidate.FullName,
            PrimaryRole = candidate.PrimaryRole,
            TotalScore = candidate.TotalScore,
            IsEligible = candidate.IsEligible,
            ExclusionReason = candidate.ExclusionReason,
            Status = candidate.IsEligible
                ? "כשיר"
                : (string.IsNullOrWhiteSpace(candidate.ExclusionReason) ? "לא כשיר" : candidate.ExclusionReason!),
            RecommendationSummary = candidate.RecommendationSummary,
            Warnings = ParseWarnings(candidate.WarningsJson),
            Factors = candidate.Factors.Select(MapFactor).ToList()
        };
    }

    private static List<string> ParseWarnings(string? warningsJson)
    {
        if (string.IsNullOrWhiteSpace(warningsJson) || warningsJson == "[]")
        {
            return new List<string>();
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<string>>(warningsJson) ?? new List<string>();
        }
        catch (System.Text.Json.JsonException)
        {
            return new List<string>();
        }
    }
}
