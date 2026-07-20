namespace ManageR2.Api.Features.ServiceCalls.DTOs;

public class ServiceCallResponseDto
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string WorkType { get; set; } = string.Empty;
    public string? TaskCategory { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? BillingType { get; set; }
    public int? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? SiteId { get; set; }
    public string? SiteName { get; set; }
    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public decimal? EstimatedHours { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }
    public string? RequiredRole { get; set; }
    public List<string> RequiredRoles { get; set; } = new();
    public bool IsLocked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
}

public class CreateServiceCallRequestDto
{
    private string? _requiredRole;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Status { get; set; }
    public string BillingType { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public int? SiteId { get; set; }
    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }
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
}

public class UpdateServiceCallRequestDto : CreateServiceCallRequestDto
{
    public List<ServiceCallEmployeeReplacementRequestDto>? EmployeeReplacements { get; set; }
}

public class ServiceCallEmployeeReplacementRequestDto
{
    public int WorkEmployeeAssignmentId { get; set; }
    public int EmployeeId { get; set; }
}

public class AssignServiceCallEmployeeRequestDto
{
    public int EmployeeId { get; set; }
    public string AssignmentRole { get; set; } = string.Empty;
    public int? RecommendationRunId { get; set; }
}
