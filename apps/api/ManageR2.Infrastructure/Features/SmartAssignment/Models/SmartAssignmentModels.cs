using System;
using System.Collections.Generic;

namespace ManageR2.Infrastructure.Models
{
    // Service-layer input mapped from SmartAssignmentRequestDto before batch recommendation logic runs.
    public class SmartAssignmentRequestModel
    {
        public int? ProjectId { get; set; }
        public List<int>? WorkItemIds { get; set; }
        public DateTime? PlanningDate { get; set; }
        public bool IncludeLockedTasks { get; set; }
        public bool SaveRun { get; set; }
    }

    // Working set loaded for one batch run (tasks, roster, current assignments) — internal to recommendation pipeline, not an API contract.
    public class SmartAssignmentInputModel
    {
        public List<SmartAssignmentTaskModel> Tasks { get; set; } = new List<SmartAssignmentTaskModel>();
        public List<SmartAssignmentEmployeeModel> Employees { get; set; } = new List<SmartAssignmentEmployeeModel>();
        public List<SmartAssignmentAssignmentModel> Assignments { get; set; } = new List<SmartAssignmentAssignmentModel>();
    }

    // Task facts used by engine rules (hours, dates, lock) distinct from full WorkItem domain entity.
    public class SmartAssignmentTaskModel
    {
        public int WorkItemId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public string? RequiredRole { get; set; }
        public string? Priority { get; set; }
        public decimal? EstimatedHours { get; set; }
        public DateTime? PlannedStart { get; set; }
        public DateTime? PlannedEnd { get; set; }
        public bool IsLocked { get; set; }
    }

    // Roster snapshot for capacity and matching (subset of Employee columns needed for scoring).
    public class SmartAssignmentEmployeeModel
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string? PrimaryRole { get; set; }
        public bool IsAssignable { get; set; }
        public bool IsActive { get; set; }
        public decimal? CapacityHours { get; set; }
    }

    // Current assignment facts per work item (who holds hours today) feeding diff/recommendation output.
    public class SmartAssignmentAssignmentModel
    {
        public int WorkItemId { get; set; }
        public int? EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public decimal AssignedHours { get; set; }
    }

    // Batch run outcome returned to SmartAssignmentController and mapped to SmartAssignmentResponseDto (summary + lists).
    public class SmartAssignmentRunResultModel
    {
        public int? RecommendationRunId { get; set; }
        public DateTime GeneratedAt { get; set; }
        // Run-level counters and narrative for summary DTO; lists hold detailed rows for grid + charts.
        public int TotalTasks { get; set; }
        public int TasksWithRecommendations { get; set; }
        public int ViolationsCount { get; set; }
        public int WarningsCount { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<SmartAssignmentRecommendationModel> Recommendations { get; set; } = new List<SmartAssignmentRecommendationModel>();
        public List<SmartAssignmentEmployeeLoadModel> EmployeeLoad { get; set; } = new List<SmartAssignmentEmployeeLoadModel>();
        public List<SmartAssignmentTaskResultModel> TaskResults { get; set; } = new List<SmartAssignmentTaskResultModel>();
    }

    // Per-task recommendation line (current vs suggested assignee, rule messages) for the response grid.
    public class SmartAssignmentTaskResultModel
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
    }

    // Alternate compact recommendation row shape (work item + ids + score) if used by older engine paths.
    public class SmartAssignmentRecommendationModel
    {
        public int WorkItemId { get; set; }
        public int? CurrentEmployeeId { get; set; }
        public int? RecommendedEmployeeId { get; set; }
        public decimal Score { get; set; }
        public List<string> Violations { get; set; } = new List<string>();
        public List<string> Warnings { get; set; } = new List<string>();
        public List<string> Reasons { get; set; } = new List<string>();
    }

    // Capacity snapshot row paired with task results for load charts in the batch assignment UI.
    public class SmartAssignmentEmployeeLoadModel
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public decimal AssignedHours { get; set; }
        public decimal? CapacityHours { get; set; }
        public decimal LoadPercentage { get; set; }
    }
}
