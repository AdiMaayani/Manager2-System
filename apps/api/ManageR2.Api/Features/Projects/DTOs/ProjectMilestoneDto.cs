using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs;

// WorkItemsController milestones GET: nested employees/contractors for Gantt-style views (not the flat domain WorkItem).
// Milestone response contract including linked assignment participants.
public class ProjectMilestoneDto
{
    public int WorkItemId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string WorkType { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? BillingType { get; set; }

    public int CustomerId { get; set; }

    public int? SiteId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? PlannedStart { get; set; }

    public DateTime? PlannedEnd { get; set; }

    public DateTime? ClosedAt { get; set; }

    public string? Priority { get; set; }

    public string? RequiredRole { get; set; }

    public decimal? EstimatedHours { get; set; }

    public DateTime? ActualStart { get; set; }

    public DateTime? ActualEnd { get; set; }

    public decimal? ActualHours { get; set; }

    public bool IsLocked { get; set; }

    public List<ProjectMilestoneEmployeeDto> Employees { get; set; } = new();

    public List<ProjectMilestoneContractorDto> Contractors { get; set; } = new();
}

// Employee assignment details under a milestone.
public class ProjectMilestoneEmployeeDto
{
    public int EmployeeId { get; set; }

    public string EmployeeName { get; set; } = string.Empty;

    public string? AssignmentRole { get; set; }

    public decimal? AssignedHours { get; set; }

    public bool? IsManualAssignment { get; set; }
}

// Contractor assignment details under a milestone.
public class ProjectMilestoneContractorDto
{
    public int ContractorId { get; set; }

    public string ContractorName { get; set; } = string.Empty;

    public string? AssignmentRole { get; set; }
}
