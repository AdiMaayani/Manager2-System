using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Services;
using ManageR2.Infrastructure.Services.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;
using ManageR2.Domain.Features.SmartAssignment;
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
    private readonly ISmartAssignmentFeedbackService _feedbackService;

    public SmartAssignmentController(
        ISmartAssignmentService smartAssignmentService,
        IAdvancedSmartAssignmentService advancedSmartAssignmentService,
        ISmartAssignmentFeedbackService feedbackService)
    {
        _smartAssignmentService = smartAssignmentService;
        _advancedSmartAssignmentService = advancedSmartAssignmentService;
        _feedbackService = feedbackService;
    }

    // POST: map DTO to service model, run algorithm, map rich service response back to API DTO for the UI.
    [HttpPost("recommend")]
    public async Task<IActionResult> Recommend(
        [FromBody] SmartAssignmentRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // Service layer owns planning date, locked-task inclusion, and optional save-run side effects.
        var serviceRequest = new SmartAssignmentRequestModel
        {
            ProjectId = request.ProjectId,
            WorkItemIds = request.WorkItemIds,
            PlanningDate = request.PlanningDate,
            IncludeLockedTasks = request.IncludeLockedTasks,
            SaveRun = request.SaveRun,
            WeightsOverride = MapWeights(request.Weights),
            RequestedByUserId = GetCurrentUserId()
        };

        var serviceResponse = await _smartAssignmentService.GenerateRecommendationsAsync(
            serviceRequest,
            cancellationToken);
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
                Factors = r.Factors.Select(MapFactor).ToList(),
                BestIneligibleAlternative = r.BestIneligibleAlternative is null
                    ? null
                    : MapCandidate(r.BestIneligibleAlternative),
                PolicyProfileKey = r.PolicyProfileKey,
                PolicyVersion = r.PolicyVersion,
                PolicyDisplayName = r.PolicyDisplayName,
                RequiredRoles = r.RequiredRoles,
                Candidates = r.Candidates.Select(MapCandidate).ToList()
            }).ToList(),
            EmployeeLoad = serviceResponse.EmployeeLoad.Select(l => new SmartAssignmentEmployeeLoadDto
            {
                EmployeeId = l.EmployeeId,
                EmployeeName = l.EmployeeName,
                AssignedHours = l.AssignedHours,
                CapacityHours = l.CapacityHours,
                LoadPercentage = l.LoadPercentage
            }).ToList(),
            CompatibilityWarnings = serviceResponse.CompatibilityWarnings
        };

        return Ok(response);
    }

    // POST: ranked recommendations for a NOT-YET-SAVED (draft) task, scored against the draft's own
    // context (project/date/duration/site) rather than unrelated existing project tasks. Preview only —
    // nothing is persisted because there is no task id yet.
    [HttpPost("recommend-draft")]
    public async Task<IActionResult> RecommendDraft(
        [FromBody] DraftTaskRecommendationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var requiredRoles = ProfessionCollection.Resolve(request.RequiredRoles, request.RequiredRole);
        var context = new DraftTaskRecommendationContextModel
        {
            TaskCategory = request.TaskCategory,
            ProjectId = request.ProjectId,
            CustomerId = request.CustomerId,
            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            EstimatedHours = DeriveEstimatedHours(request.PlannedStart, request.PlannedEnd),
            Priority = request.Priority,
            RequiredRole = requiredRoles.FirstOrDefault(),
            RequiredRoles = requiredRoles.ToList(),
            SiteId = request.SiteId,
            WeightsOverride = MapWeights(request.Weights)
        };

        var candidates = await _advancedSmartAssignmentService.GetRecommendationsForDraftAsync(
            context,
            cancellationToken);

        var response = new DraftTaskRecommendationResponseDto
        {
            GeneratedAt = DateTime.UtcNow,
            Message = candidates.Count == 0
                ? "לא נמצאו עובדים פעילים."
                : "העובדים דורגו כתמיכה בהחלטת השיבוץ.",
            Candidates = candidates.Select(MapCandidate).ToList()
        };

        return Ok(response);
    }

    [HttpPost("feedback")]
    public async Task<IActionResult> UpsertFeedback(
        [FromBody] UpsertRecommendationFeedbackRequestDto request,
        CancellationToken cancellationToken)
    {
        var actingUserId = GetCurrentUserId();
        if (actingUserId is null)
        {
            return Forbid();
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        var feedback = await _feedbackService.UpsertAsync(
            new RecommendationFeedbackCommand(
                new RecommendationFeedbackIdentity(
                    request.RecommendationRunId,
                    request.WorkItemId,
                    request.RecommendedEmployeeId,
                    request.PolicyProfileKey,
                    request.PolicyVersion),
                request.Rating,
                request.Comment,
                actingUserId.Value,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                string.IsNullOrWhiteSpace(userAgent) ? null : userAgent),
            cancellationToken);

        return Ok(MapFeedback(feedback));
    }

    [HttpGet("feedback")]
    public async Task<IActionResult> GetFeedback(
        [FromQuery] int recommendationRunId,
        [FromQuery] int workItemId,
        [FromQuery] int recommendedEmployeeId,
        [FromQuery] string policyProfileKey,
        [FromQuery] int policyVersion,
        CancellationToken cancellationToken)
    {
        var actingUserId = GetCurrentUserId();
        if (actingUserId is null)
        {
            return Forbid();
        }

        var feedback = await _feedbackService.GetAsync(
            new RecommendationFeedbackIdentity(
                recommendationRunId,
                workItemId,
                recommendedEmployeeId,
                policyProfileKey,
                policyVersion),
            actingUserId.Value,
            cancellationToken);

        return feedback is null ? NoContent() : Ok(MapFeedback(feedback));
    }

    [HttpGet("work-items/{workItemId:int}/assignment-feedback")]
    public async Task<IActionResult> GetTaskAssignmentFeedback(
        int workItemId,
        [FromQuery] int assignedEmployeeId,
        CancellationToken cancellationToken)
    {
        var actingUserId = GetCurrentUserId();
        if (actingUserId is null)
        {
            return Forbid();
        }

        var state = await _feedbackService.GetTaskAssignmentStateAsync(
            workItemId,
            assignedEmployeeId,
            actingUserId.Value,
            cancellationToken);

        if (state is null)
        {
            return NotFound(new
            {
                message = "The employee is not assigned to the requested work item."
            });
        }

        return Ok(new TaskAssignmentFeedbackStateDto
        {
            WorkItemId = state.WorkItemId,
            AssignedEmployeeId = state.AssignedEmployeeId,
            AssignedEmployeeName = state.AssignedEmployeeName,
            IsManualAssignment = state.IsManualAssignment,
            AssignmentMethod = state.AssignmentMethod,
            RecommendationRunId = state.RecommendationRunId,
            PolicyProfileKey = state.PolicyProfileKey,
            PolicyVersion = state.PolicyVersion,
            RankOrder = state.RankOrder,
            Score = state.Score,
            Feedback = state.Feedback is null ? null : MapFeedback(state.Feedback),
            Recommendation = state.Recommendation is null
                ? null
                : new TaskAssignmentRecommendationDto
                {
                    RecommendationId = state.Recommendation.RecommendationId,
                    RecommendationRunId = state.Recommendation.RecommendationRunId,
                    RankOrder = state.Recommendation.RankOrder,
                    TotalScore = state.Recommendation.TotalScore,
                    PolicyProfileKey = state.Recommendation.PolicyProfileKey,
                    PolicyVersion = state.Recommendation.PolicyVersion,
                    PolicyDisplayName = state.Recommendation.PolicyDisplayName,
                    TravelMinutes = state.Recommendation.TravelMinutes,
                    DistanceKm = state.Recommendation.DistanceKm,
                    Factors = state.Recommendation.Factors.Select(factor =>
                         new TaskAssignmentRecommendationFactorDto
                         {
                             Key = factor.Key,
                             Label = GetPersistedFactorLabel(factor.Key),
                             Score = factor.Score,
                             WeightPercent = factor.WeightPercent,
                             WeightedContribution = factor.WeightedContribution,
                             IsTieBreaker = factor.IsTieBreak
                         }).ToList()
                 }
         });
     }

    private static string GetPersistedFactorLabel(string key) => key switch
    {
        SmartAssignmentFactorCodes.ProfessionalFit => "התאמה מקצועית",
        SmartAssignmentFactorCodes.Availability => "זמינות",
        SmartAssignmentFactorCodes.Workload => "עומס עבודה",
        SmartAssignmentFactorCodes.Geography => "מרחק / נסיעה",
        SmartAssignmentFactorCodes.Experience => "ניסיון",
        SmartAssignmentFactorCodes.Continuity => "רציפות",
        _ => key
    };

    private static decimal? DeriveEstimatedHours(DateTime plannedStart, DateTime plannedEnd)
    {
        if (plannedEnd <= plannedStart)
        {
            return null;
        }

        return DurationCalculator.TryCalculate(plannedStart, plannedEnd)?.EstimatedHours;
    }

    private static SmartAssignmentWeights? MapWeights(SmartAssignmentWeightsDto? weights) =>
        weights is null
            ? null
            : new SmartAssignmentWeights(
                weights.ProfessionalFit,
                weights.Availability,
                weights.Workload,
                weights.Geography,
                weights.Experience);

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
            HasData = factor.HasData,
            WeightedContribution = factor.WeightedContribution,
            IsDefaulted = factor.IsDefaulted,
            MissingInputCodes = factor.MissingInputCodes,
            SourceValues = factor.SourceValues
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
            Professions = candidate.Professions,
            TotalScore = candidate.TotalScore,
            IsEligible = candidate.IsEligible,
            ExclusionReason = candidate.ExclusionReason,
            Status = candidate.IsEligible
                ? "ניתן לבחירה"
                : (string.IsNullOrWhiteSpace(candidate.ExclusionReason) ? "לא זמין לבחירה" : candidate.ExclusionReason!),
            RecommendationSummary = candidate.RecommendationSummary,
            Warnings = ParseWarnings(candidate.WarningsJson),
            Factors = candidate.Factors.Select(MapFactor).ToList(),
            RejectionReasons = candidate.RejectionReasons.Select(reason => new RecommendationRejectionDto
            {
                Code = reason.Code,
                Explanation = reason.Explanation
            }).ToList(),
            MissingInputCodes = candidate.MissingInputCodes,
            PolicyProfileKey = candidate.PolicyProfileKey,
            PolicyVersion = candidate.PolicyVersion,
            PolicyDisplayName = candidate.PolicyDisplayName,
            RequiredRoles = candidate.RequiredRoles,
            MatchedRoles = candidate.MatchedRoles,
            MissingRoles = candidate.MissingRoles,
            OriginTypeUsed = candidate.OriginTypeUsed,
            TravelMinutes = candidate.TravelMinutes,
            DistanceKm = candidate.DistanceKm
        };
    }

    private static RecommendationFeedbackResponseDto MapFeedback(RecommendationFeedbackRecord feedback) =>
        new()
        {
            FeedbackId = feedback.RecommendationFeedbackId,
            RecommendationRunId = feedback.RecommendationRunId,
            WorkItemId = feedback.WorkItemId,
            RecommendedEmployeeId = feedback.RecommendedEmployeeId,
            PolicyProfileKey = feedback.PolicyProfileKey,
            PolicyVersion = feedback.PolicyVersion,
            Rating = feedback.Rating,
            Comment = feedback.Comment,
            ActingUserId = feedback.ActingUserId,
            CreatedAtUtc = feedback.CreatedAtUtc,
            UpdatedAtUtc = feedback.UpdatedAtUtc,
            WasCreated = feedback.WasCreated,
            WasChanged = feedback.WasChanged
        };

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
