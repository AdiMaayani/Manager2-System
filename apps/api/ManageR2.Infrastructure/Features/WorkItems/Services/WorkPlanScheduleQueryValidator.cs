using ManageR2.Infrastructure.Features.WorkItems.Models;

namespace ManageR2.Infrastructure.Features.WorkItems.Services;

public static class WorkPlanScheduleQueryValidator
{
    private static readonly HashSet<string> AllowedScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "company",
        "personal",
        "employee",
        "project"
    };

    private static readonly HashSet<string> AllowedTaskCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Regular",
        "Project",
        "ServiceCall"
    };

    public static string? Validate(WorkPlanScheduleQuery query)
    {
        if (!AllowedScopes.Contains(query.Scope))
        {
            return "Invalid schedule scope.";
        }

        if (query.Scope.Equals("project", StringComparison.OrdinalIgnoreCase)
            && (!query.ProjectId.HasValue || query.ProjectId.Value <= 0))
        {
            return "Project scope requires ProjectId.";
        }

        if (query.Scope.Equals("employee", StringComparison.OrdinalIgnoreCase)
            && (!query.EmployeeId.HasValue || query.EmployeeId.Value <= 0))
        {
            return "Employee scope requires EmployeeId.";
        }

        if (query.Scope.Equals("personal", StringComparison.OrdinalIgnoreCase)
            && (!query.CurrentUserEmployeeId.HasValue || query.CurrentUserEmployeeId.Value <= 0))
        {
            return "Personal scope requires CurrentUserEmployeeId.";
        }

        if (!string.IsNullOrWhiteSpace(query.TaskCategory)
            && !AllowedTaskCategories.Contains(query.TaskCategory))
        {
            return "Invalid TaskCategory filter.";
        }

        if (query.FromUtc.HasValue != query.ToUtc.HasValue)
        {
            return "fromUtc and toUtc must both be supplied or both be null.";
        }

        if (query.FromUtc.HasValue && query.ToUtc!.Value <= query.FromUtc.Value)
        {
            return "Invalid UTC range.";
        }

        return null;
    }
}
