using System;
using System.Collections.Generic;

namespace ManageR2.Infrastructure.Models
{
    public class SmartAssignmentRequestModel
    {
        public int? ProjectId { get; set; }
        public List<int>? WorkItemIds { get; set; }
        public DateTime? PlanningDate { get; set; }
        public bool IncludeLockedTasks { get; set; }
        public bool SaveRun { get; set; }
    }

    public class SmartAssignmentInputModel
    {
        public List<SmartAssignmentTaskModel> Tasks { get; set; } = new List<SmartAssignmentTaskModel>();
        public List<SmartAssignmentEmployeeModel> Employees { get; set; } = new List<SmartAssignmentEmployeeModel>();
        public List<SmartAssignmentAssignmentModel> Assignments { get; set; } = new List<SmartAssignmentAssignmentModel>();
    }

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

    public class SmartAssignmentEmployeeModel
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string? PrimaryRole { get; set; }
        public bool IsAssignable { get; set; }
        public bool IsActive { get; set; }
        public decimal? CapacityHours { get; set; }
    }

    public class SmartAssignmentAssignmentModel
    {
        public int WorkItemId { get; set; }
        public int? EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public decimal AssignedHours { get; set; }
    }

    public class SmartAssignmentRunResultModel
    {
        public int? RecommendationRunId { get; set; }
        public DateTime GeneratedAt { get; set; }
        public int TotalTasks { get; set; }
        public int TasksWithRecommendations { get; set; }
        public int ViolationsCount { get; set; }
        public int WarningsCount { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<SmartAssignmentRecommendationModel> Recommendations { get; set; } = new List<SmartAssignmentRecommendationModel>();
        public List<SmartAssignmentEmployeeLoadModel> EmployeeLoad { get; set; } = new List<SmartAssignmentEmployeeLoadModel>();
        public List<SmartAssignmentTaskResultModel> TaskResults { get; set; } = new List<SmartAssignmentTaskResultModel>();
    }

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

    public class SmartAssignmentEmployeeLoadModel
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public decimal AssignedHours { get; set; }
        public decimal? CapacityHours { get; set; }
        public decimal LoadPercentage { get; set; }
    }
}
