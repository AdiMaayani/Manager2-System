using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs
{
    // WorkItemsController work-plan GET: denormalized tree for scheduling UI (domain stays row-per WorkItem in DB).
    // Response contract for work plan endpoint: project + tasks + assignments.
    public class WorkPlanDto
    {
        public ProjectSummaryDto Project { get; set; } = new ProjectSummaryDto();
        public List<TaskSummaryDto> Tasks { get; set; } = new List<TaskSummaryDto>();
        public List<WorkAssignmentDto> Assignments { get; set; } = new List<WorkAssignmentDto>();
    }

    // Project header section in the work plan response.
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
        public DateTime? DealCloseDate { get; set; }
        public string? FinanceProjectNumber { get; set; }
        public string? InvoiceNumber { get; set; }
    }

    // Task/milestone section in the work plan response.
    public class TaskSummaryDto
    {
        public int WorkItemId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string WorkType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? BillingType { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Priority { get; set; }
        public DateTime? PlannedStart { get; set; }
        public DateTime? PlannedEnd { get; set; }
        public string? RequiredRole { get; set; }
        public bool IsLocked { get; set; }
        public int? CustomerId { get; set; }
        public int? SiteId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public int? ParentWorkItemId { get; set; }
        public DateTime? DealCloseDate { get; set; }
        public string? FinanceProjectNumber { get; set; }
        public string? InvoiceNumber { get; set; }
    }

    // Assignment section that links employees/contractors to work items.
    public class WorkAssignmentDto
    {
        public int WorkItemId { get; set; }
        public int? EmployeeId { get; set; }
        public int? ContractorId { get; set; }
        public string AssignmentType { get; set; } = string.Empty;
        public string? AssignmentRole { get; set; }
        public decimal? AssignedHours { get; set; }
        public bool IsManualAssignment { get; set; }
        public string? EmployeeName { get; set; }
        public string? ContractorName { get; set; }
    }

    public class WorkPlanScheduleDto
    {
        public List<WorkPlanScheduledTaskDto> ScheduledTasks { get; set; } = new();
        public List<WorkPlanScheduledTaskDto> UnscheduledTasks { get; set; } = new();
        public List<WorkPlanEmployeeDto> Employees { get; set; } = new();
    }

    public class WorkPlanScheduledTaskDto
    {
        public int WorkItemId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? TaskCategory { get; set; }
        public string? WorkType { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public DateTime? PlannedStart { get; set; }
        public DateTime? PlannedEnd { get; set; }
        public int? DerivedDurationMinutes { get; set; }
        public decimal? EstimatedHours { get; set; }
        public bool IsLocked { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public int? SiteId { get; set; }
        public string? SiteName { get; set; }
        public int? ProjectId { get; set; }
        public string? ProjectTitle { get; set; }
        public int? MilestoneId { get; set; }
        public string? MilestoneTitle { get; set; }
        public bool IsServiceCall { get; set; }
        public List<WorkPlanTaskAssignmentDto> Assignments { get; set; } = new();
    }

    public class WorkPlanTaskAssignmentDto
    {
        public int? EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string? AssignmentRole { get; set; }
        public decimal? AssignedHours { get; set; }
        public bool IsManualAssignment { get; set; }
        public string AssignmentSource { get; set; } = "Task";
    }

    public class WorkPlanEmployeeDto
    {
        public int EmployeeId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? PrimaryRole { get; set; }
        public bool IsActive { get; set; }
        public bool IsAssignable { get; set; }
    }
}