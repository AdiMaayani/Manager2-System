using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs;

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

public class CreateTaskRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int SiteId { get; set; }
    public int? ParentWorkItemId { get; set; }
    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}

public class AssignEmployeeRequest
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

public class AssignContractorRequest
{
    public int ContractorId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

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
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public bool IsLocked { get; set; }

    public List<CreateMilestoneEmployeeAssignmentRequest> Employees { get; set; } = new();
    public List<CreateMilestoneContractorAssignmentRequest> Contractors { get; set; } = new();
}

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
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public bool IsLocked { get; set; }

    public List<CreateMilestoneEmployeeAssignmentRequest> Employees { get; set; } = new();
    public List<CreateMilestoneContractorAssignmentRequest> Contractors { get; set; } = new();
}

public class CreateMilestoneEmployeeAssignmentRequest
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}

public class CreateMilestoneContractorAssignmentRequest
{
    public int ContractorId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
}