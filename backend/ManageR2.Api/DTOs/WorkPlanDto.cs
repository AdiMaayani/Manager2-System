using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs
{
    public class WorkPlanDto
    {
        public ProjectSummaryDto Project { get; set; } = new ProjectSummaryDto();
        public List<TaskSummaryDto> Tasks { get; set; } = new List<TaskSummaryDto>();
        public List<WorkAssignmentDto> Assignments { get; set; } = new List<WorkAssignmentDto>();
    }

    public class ProjectSummaryDto
    {
        public int WorkItemId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string WorkType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? BillingType { get; set; }
        public int? CustomerId { get; set; }
        public int? SiteId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public int? ParentWorkItemId { get; set; }
    }

    public class TaskSummaryDto
    {
        public int WorkItemId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string WorkType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? BillingType { get; set; }
        public int? CustomerId { get; set; }
        public int? SiteId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public int? ParentWorkItemId { get; set; }
    }

    public class WorkAssignmentDto
    {
        public int WorkItemId { get; set; }
        public int? EmployeeId { get; set; }
        public int? ContractorId { get; set; }
        public string AssignmentType { get; set; } = string.Empty;
        public string? AssignmentRole { get; set; }
        public string? EmployeeName { get; set; }
        public string? ContractorName { get; set; }
    }
}