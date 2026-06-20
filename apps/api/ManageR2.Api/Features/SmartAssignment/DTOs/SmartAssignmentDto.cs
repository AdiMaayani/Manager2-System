using System;
using System.Collections.Generic;

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
    }

    // Batch recommendation outcome: summary + per-task rows + capacity snapshot for the same HTTP response.
    public class SmartAssignmentResponseDto
    {
        public int? RecommendationRunId { get; set; }
        public DateTime GeneratedAt { get; set; }
        public SmartAssignmentSummaryDto Summary { get; set; } = new SmartAssignmentSummaryDto();
        public List<SmartAssignmentTaskResultDto> TaskResults { get; set; } = new List<SmartAssignmentTaskResultDto>();
        public List<SmartAssignmentEmployeeLoadDto> EmployeeLoad { get; set; } = new List<SmartAssignmentEmployeeLoadDto>();
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
        public int? SiteId { get; set; }
    }

    // One ranked candidate for the draft recommendation, including the explainability breakdown.
    public class SmartAssignmentCandidateDto
    {
        public int? RankOrder { get; set; }
        public int EmployeeId { get; set; }
        public string? FullName { get; set; }
        public string? PrimaryRole { get; set; }
        public decimal? TotalScore { get; set; }
        public bool IsEligible { get; set; }
        public string? ExclusionReason { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? RecommendationSummary { get; set; }
        public List<string> Warnings { get; set; } = new List<string>();
        public List<RecommendationFactorDto> Factors { get; set; } = new List<RecommendationFactorDto>();
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
}
