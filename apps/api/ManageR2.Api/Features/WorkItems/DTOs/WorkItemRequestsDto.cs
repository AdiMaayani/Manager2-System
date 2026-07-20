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
    public string? Status { get; set; }
    public string BillingType { get; set; } = string.Empty;
    public string TaskCategory { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public int? SiteId { get; set; }
    public int? ParentWorkItemId { get; set; }
    public int? MilestoneId { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public List<string>? RequiredRoles { get; set; }
    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}

public class UpdateTaskRequest
{
    private string? _requiredRole;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Status { get; set; }
    public string BillingType { get; set; } = string.Empty;
    public string TaskCategory { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public int? SiteId { get; set; }
    public int? ParentWorkItemId { get; set; }
    public int? MilestoneId { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? Priority { get; set; }
    public string? RequiredRole
    {
        get => _requiredRole;
        set
        {
            _requiredRole = value;
            RequiredRoleWasProvided = true;
        }
    }
    [System.Text.Json.Serialization.JsonIgnore]
    public bool RequiredRoleWasProvided { get; private set; }
    public List<string>? RequiredRoles { get; set; }
    public bool IsLocked { get; set; }
    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
    public List<EmployeeAssignmentReplacementRequest>? EmployeeReplacements { get; set; }
}

public class AssignEmployeeRequest
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
    public int? RecommendationRunId { get; set; }
}

public class UpdateEmployeeAssignmentRequest
{
    public int EmployeeId { get; set; }

    // When supplied, the replacement is recorded as a Smart Assignment: the recommendation run is
    // resolved for this work item + replacement employee and stored, and IsManualAssignment is cleared.
    // When null, the existing manual replacement behavior is preserved.
    public int? RecommendationRunId { get; set; }
}

public class EmployeeAssignmentReplacementRequest
{
    public int WorkEmployeeAssignmentId { get; set; }
    public int EmployeeId { get; set; }
}

public class SyncEmployeeAssignmentsRequest
{
    public List<AssignEmployeeRequest> Employees { get; set; } = new();
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
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }
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
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }
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

public class WorkItemReportTargetDto
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string TaskCategory { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? SiteId { get; set; }
    public string? SiteName { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectTitle { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? RequiredRole { get; set; }
    public List<string> RequiredRoles { get; set; } = new();
    public List<WorkItemReportAssignmentDto> Assignments { get; set; } = new();
}

public class WorkItemReportAssignmentDto
{
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? AssignmentRole { get; set; }
    public bool IsManualAssignment { get; set; }
    public string AssignmentSource { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsAssignable { get; set; }
}
