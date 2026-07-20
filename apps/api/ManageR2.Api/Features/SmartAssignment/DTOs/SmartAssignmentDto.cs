using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ManageR2.Api.DTOs
{
    // SmartAssignmentController POST body: planning inputs only (no per-task results until service runs).
    public class SmartAssignmentRequestDto
    {
        public int? ProjectId { get; set; }
        public List<int>? WorkItemIds { get; set; }
        public DateTime? PlanningDate { get; set; }
        public bool IncludeLockedTasks { get; set; }
        public bool SaveRun { get; set; }
        public SmartAssignmentWeightsDto? Weights { get; set; }
    }

    // Optional per-run scoring weights. They affect only the current recommendation request and
    // never update the persisted Smart Assignment policy.
    public sealed class SmartAssignmentWeightsDto
    {
        public decimal ProfessionalFit { get; set; }
        public decimal Availability { get; set; }
        public decimal Workload { get; set; }
        public decimal Geography { get; set; }
        public decimal Experience { get; set; }
    }

    // Batch recommendation outcome: summary + per-task rows + capacity snapshot for the same HTTP response.
    public class SmartAssignmentResponseDto
    {
        public int? RecommendationRunId { get; set; }
        public DateTime GeneratedAt { get; set; }
        public SmartAssignmentSummaryDto Summary { get; set; } = new SmartAssignmentSummaryDto();
        public List<SmartAssignmentTaskResultDto> TaskResults { get; set; } = new List<SmartAssignmentTaskResultDto>();
        public List<SmartAssignmentEmployeeLoadDto> EmployeeLoad { get; set; } = new List<SmartAssignmentEmployeeLoadDto>();
        public List<string> CompatibilityWarnings { get; set; } = new List<string>();
    }

    // High-level counts and narrative message for the assignment run UI.
    public class SmartAssignmentSummaryDto
    {
        public int TotalTasks { get; set; }
        public int TasksWithRecommendations { get; set; }
        public int ViolationsCount { get; set; }
        public int WarningsCount { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    // One work item’s recommendation row: current vs suggested assignee plus rule violations/warnings.
    public class SmartAssignmentTaskResultDto
    {
        public int WorkItemId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public int? CurrentEmployeeId { get; set; }
        public string? CurrentEmployeeName { get; set; }
        public int? RecommendedEmployeeId { get; set; }
        public string? RecommendedEmployeeName { get; set; }
        public decimal Score { get; set; }
        public List<string> Violations { get; set; } = new List<string>();
        public List<string> Warnings { get; set; } = new List<string>();
        public List<string> Reasons { get; set; } = new List<string>();
        // Factor breakdown for the recommended employee (explainability).
        public List<RecommendationFactorDto> Factors { get; set; } = new List<RecommendationFactorDto>();
        public SmartAssignmentCandidateDto? BestIneligibleAlternative { get; set; }
        public string? PolicyProfileKey { get; set; }
        public int? PolicyVersion { get; set; }
        public string? PolicyDisplayName { get; set; }
        public List<string> RequiredRoles { get; set; } = new();

        // Full ranked candidate list for this task, enabling a saved-task rerun to present every
        // active employee for selection while the recommendation run remains authoritative.
        public List<SmartAssignmentCandidateDto> Candidates { get; set; } = new List<SmartAssignmentCandidateDto>();
    }

    // One explainability factor (professional/availability/workload/geographic/experience).
    public class RecommendationFactorDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public decimal? Score { get; set; }
        public decimal WeightPercent { get; set; }
        public string Explanation { get; set; } = string.Empty;
        public string DataSource { get; set; } = string.Empty;
        public bool HasData { get; set; }
        public decimal WeightedContribution { get; set; }
        public bool IsDefaulted { get; set; }
        public List<string> MissingInputCodes { get; set; } = new List<string>();
        public Dictionary<string, object?> SourceValues { get; set; } = new Dictionary<string, object?>();
    }

    // New Task draft recommendation request: scores candidates for a not-yet-saved task context.
    public class DraftTaskRecommendationRequestDto
    {
        public string TaskCategory { get; set; } = string.Empty;
        public int? ProjectId { get; set; }
        public int? CustomerId { get; set; }
        public DateTime PlannedStart { get; set; }
        public DateTime PlannedEnd { get; set; }
        public string? Priority { get; set; }
        public string? RequiredRole { get; set; }
        // Additive replacement. When omitted, RequiredRole remains the compatibility fallback.
        public List<string>? RequiredRoles { get; set; }
        public int? SiteId { get; set; }
        public SmartAssignmentWeightsDto? Weights { get; set; }
    }

    // One ranked candidate for the draft recommendation, including the explainability breakdown.
    public class SmartAssignmentCandidateDto
    {
        public int? RankOrder { get; set; }
        public int EmployeeId { get; set; }
        public string? FullName { get; set; }
        public string? PrimaryRole { get; set; }
        public List<string> Professions { get; set; } = new();
        public decimal? TotalScore { get; set; }
        public bool IsEligible { get; set; }
        public string? ExclusionReason { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? RecommendationSummary { get; set; }
        public List<string> Warnings { get; set; } = new List<string>();
        public List<RecommendationFactorDto> Factors { get; set; } = new List<RecommendationFactorDto>();
        public List<RecommendationRejectionDto> RejectionReasons { get; set; } = new List<RecommendationRejectionDto>();
        public List<string> MissingInputCodes { get; set; } = new List<string>();
        public string? PolicyProfileKey { get; set; }
        public int? PolicyVersion { get; set; }
        public string? PolicyDisplayName { get; set; }
        public List<string> RequiredRoles { get; set; } = new();
        public List<string> MatchedRoles { get; set; } = new();
        public List<string> MissingRoles { get; set; } = new();
        public string? OriginTypeUsed { get; set; }
        public int? TravelMinutes { get; set; }
        public decimal? DistanceKm { get; set; }
    }

    public class RecommendationRejectionDto
    {
        public string Code { get; set; } = string.Empty;
        public string Explanation { get; set; } = string.Empty;
    }

    public class DraftTaskRecommendationResponseDto
    {
        public DateTime GeneratedAt { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<SmartAssignmentCandidateDto> Candidates { get; set; } = new List<SmartAssignmentCandidateDto>();
    }

    // Capacity slice for fairness charts alongside task-level recommendations.
    public class SmartAssignmentEmployeeLoadDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public decimal AssignedHours { get; set; }
        public decimal? CapacityHours { get; set; }
        public decimal LoadPercentage { get; set; }
    }

    public sealed class UpsertRecommendationFeedbackRequestDto
    {
        [JsonRequired]
        public int RecommendationRunId { get; set; }

        [JsonRequired]
        public int WorkItemId { get; set; }

        [JsonRequired]
        public int RecommendedEmployeeId { get; set; }

        [JsonRequired]
        public string PolicyProfileKey { get; set; } = string.Empty;

        [JsonRequired]
        public int PolicyVersion { get; set; }

        [JsonRequired]
        public int Rating { get; set; }

        public string? Comment { get; set; }
    }

    public sealed class RecommendationFeedbackResponseDto
    {
        public long FeedbackId { get; set; }
        public int RecommendationRunId { get; set; }
        public int WorkItemId { get; set; }
        public int RecommendedEmployeeId { get; set; }
        public string PolicyProfileKey { get; set; } = string.Empty;
        public int PolicyVersion { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public int ActingUserId { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime UpdatedAtUtc { get; set; }
        public bool WasCreated { get; set; }
        public bool WasChanged { get; set; }
    }

    public sealed class TaskAssignmentFeedbackStateDto
    {
        public int WorkItemId { get; set; }
        public int AssignedEmployeeId { get; set; }
        public string AssignedEmployeeName { get; set; } = string.Empty;
        public bool IsManualAssignment { get; set; }
        public string AssignmentMethod { get; set; } = string.Empty;
        public int? RecommendationRunId { get; set; }
        public string? PolicyProfileKey { get; set; }
        public int? PolicyVersion { get; set; }
        public int? RankOrder { get; set; }
        public decimal? Score { get; set; }
        public RecommendationFeedbackResponseDto? Feedback { get; set; }
        public TaskAssignmentRecommendationDto? Recommendation { get; set; }
    }

    public sealed class TaskAssignmentRecommendationDto
    {
        public int RecommendationId { get; set; }
        public int RecommendationRunId { get; set; }
        public int RankOrder { get; set; }
        public decimal TotalScore { get; set; }
        public string? PolicyProfileKey { get; set; }
        public int? PolicyVersion { get; set; }
        public string? PolicyDisplayName { get; set; }
        public int? TravelMinutes { get; set; }
        public decimal? DistanceKm { get; set; }
        public List<TaskAssignmentRecommendationFactorDto> Factors { get; set; } = new();
    }

    public sealed class TaskAssignmentRecommendationFactorDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public decimal? Score { get; set; }
        public decimal? WeightPercent { get; set; }
        public decimal? WeightedContribution { get; set; }
        public bool IsTieBreaker { get; set; }
    }
}
