using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs;

// Typed POST bodies for WorkItemsController (narrower than sending a full WorkItem graph from the client).
// Request payload for creating a top-level project work item.
public class CreateProjectRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int SiteId { get; set; }
    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}

// Request payload for creating a child task under a project.
public class CreateTaskRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public int? SiteId { get; set; }
    public int? ParentWorkItemId { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public decimal? EstimatedHours { get; set; }
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}

// Request payload for assigning an employee to a work item.
public class AssignEmployeeRequest
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

// Request payload for replacing project-level employee assignments exactly.
public class SyncEmployeeAssignmentsRequest
{
    public List<AssignEmployeeRequest> Employees { get; set; } = new();
}

// Request payload for assigning a contractor to a work item.
public class AssignContractorRequest
{
    public int ContractorId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

// Request payload for creating a milestone/task with optional assignments.
public class CreateMilestoneRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int SiteId { get; set; }

    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public decimal? EstimatedHours { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public bool IsLocked { get; set; }

    public List<CreateMilestoneEmployeeAssignmentRequest> Employees { get; set; } = new();
    public List<CreateMilestoneContractorAssignmentRequest> Contractors { get; set; } = new();
}

// Request payload for updating milestone fields and assignment lists.
public class UpdateMilestoneRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int SiteId { get; set; }

    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public decimal? EstimatedHours { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public bool IsLocked { get; set; }

    public List<CreateMilestoneEmployeeAssignmentRequest> Employees { get; set; } = new();
    public List<CreateMilestoneContractorAssignmentRequest> Contractors { get; set; } = new();
}

// Employee assignment item inside milestone create/update payloads.
public class CreateMilestoneEmployeeAssignmentRequest
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

// Contractor assignment item inside milestone create/update payloads.
public class CreateMilestoneContractorAssignmentRequest
{
    public int ContractorId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}