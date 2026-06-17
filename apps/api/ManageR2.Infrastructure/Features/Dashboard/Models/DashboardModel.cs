namespace ManageR2.Infrastructure.Models;

// Identity + role context for the current request, resolved by the controller from JWT claims and
// passed into the service. The service performs all role-based filtering from this context so the
// payload only ever contains data the caller is permitted to see.
public class DashboardContext
{
    public int UserId { get; set; }

    // Linked employee id (Users.EmployeeId). Null/0 when the account is not tied to an employee row;
    // in that case there are simply no personal tasks to show.
    public int? EmployeeId { get; set; }

    public IReadOnlyList<string> Roles { get; set; } = new List<string>();

    // Display name for the greeting. Sourced from the JWT username claim; never a secret.
    public string DisplayName { get; set; } = string.Empty;
}

// Composed, permission-filtered dashboard payload produced by DashboardService. The controller maps
// this 1:1 to DashboardResponseDto; nothing here is returned to the client directly.
public class DashboardModel
{
    public DashboardUserModel User { get; set; } = new();

    public IReadOnlyList<DashboardKpiModel> Kpis { get; set; } = new List<DashboardKpiModel>();

    public IReadOnlyList<DashboardTaskModel> PersonalTasksToday { get; set; } = new List<DashboardTaskModel>();

    public IReadOnlyList<DashboardActionItemModel> Recommendations { get; set; } = new List<DashboardActionItemModel>();

    public IReadOnlyList<DashboardWarningModel> EarlyWarnings { get; set; } = new List<DashboardWarningModel>();

    public IReadOnlyList<DashboardActivityModel> RecentActivity { get; set; } = new List<DashboardActivityModel>();
}

public class DashboardUserModel
{
    public string DisplayName { get; set; } = string.Empty;

    public IReadOnlyList<string> RoleLabels { get; set; } = new List<string>();

    // Short Hebrew sentence describing the current operational state (built from the section counts).
    public string StateSummary { get; set; } = string.Empty;
}

public class DashboardKpiModel
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Value { get; set; }
    public string? Context { get; set; }
    // Visual emphasis hint: 'primary' | 'warning' | 'danger' | 'success' | 'neutral'.
    public string Tone { get; set; } = "primary";
    public string? ActionRoute { get; set; }
}

public class DashboardTaskModel
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Status { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? ProjectTitle { get; set; }
    public string? CustomerName { get; set; }
    public string? SiteName { get; set; }
    public string? ActionRoute { get; set; }
}

// Shared shape for actionable recommendations. severity drives ordering with PriorityScore.
public class DashboardActionItemModel
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Severity { get; set; } = "info";
    public int PriorityScore { get; set; }
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string ActionLabel { get; set; } = string.Empty;
    public string? ActionRoute { get; set; }
    public DateTime? RelevantDate { get; set; }
    public string? Context { get; set; }
}

public class DashboardWarningModel
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    // 'critical' | 'attention' | 'info'
    public string Severity { get; set; } = "attention";
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? ActionLabel { get; set; }
    public string? ActionRoute { get; set; }
    public DateTime? RelevantDate { get; set; }
    public string? Context { get; set; }
}

public class DashboardActivityModel
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ActorName { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string Severity { get; set; } = "info";
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? ActionRoute { get; set; }
}
