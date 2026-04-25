using System;
using System.Collections.Generic;

namespace ManageR2.Infrastructure.Models;

// Repository result model for milestone details under a project.
public class ProjectMilestoneResult
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

    public List<ProjectMilestoneEmployeeAssignmentResult> Employees { get; set; } = new();

    public List<ProjectMilestoneContractorAssignmentResult> Contractors { get; set; } = new();
}

// Employee assignment row under a milestone result.
public class ProjectMilestoneEmployeeAssignmentResult
{
    public int EmployeeId { get; set; }

    public string EmployeeName { get; set; } = string.Empty;

    public string? AssignmentRole { get; set; }

    public decimal? AssignedHours { get; set; }

    public bool? IsManualAssignment { get; set; }
}

// Contractor assignment row under a milestone result.
public class ProjectMilestoneContractorAssignmentResult
{
    public int ContractorId { get; set; }

    public string ContractorName { get; set; } = string.Empty;

    public string? AssignmentRole { get; set; }
}