using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs
{
    public class SmartAssignmentRequestDto
    {
        public int? ProjectId { get; set; }
        public List<int>? WorkItemIds { get; set; }
        public DateTime? PlanningDate { get; set; }
        public bool IncludeLockedTasks { get; set; }
        public bool SaveRun { get; set; }
    }

    public class SmartAssignmentResponseDto
    {
        public int? RecommendationRunId { get; set; }
        public DateTime GeneratedAt { get; set; }
        public SmartAssignmentSummaryDto Summary { get; set; } = new SmartAssignmentSummaryDto();
        public List<SmartAssignmentTaskResultDto> TaskResults { get; set; } = new List<SmartAssignmentTaskResultDto>();
        public List<SmartAssignmentEmployeeLoadDto> EmployeeLoad { get; set; } = new List<SmartAssignmentEmployeeLoadDto>();
    }

    public class SmartAssignmentSummaryDto
    {
        public int TotalTasks { get; set; }
        public int TasksWithRecommendations { get; set; }
        public int ViolationsCount { get; set; }
        public int WarningsCount { get; set; }
        public string Message { get; set; } = string.Empty;
    }

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
    }

    public class SmartAssignmentEmployeeLoadDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public decimal AssignedHours { get; set; }
        public decimal? CapacityHours { get; set; }
        public decimal LoadPercentage { get; set; }
    }
}
