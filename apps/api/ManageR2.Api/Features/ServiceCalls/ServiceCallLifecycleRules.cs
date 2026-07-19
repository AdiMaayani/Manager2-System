using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.Api.Features.ServiceCalls;

/// <summary>
/// Pure Service Call lifecycle transition rules for cancel / reopen / generic update.
/// </summary>
public static class ServiceCallLifecycleRules
{
    public const string PlannedStatus = WorkItemDefaultStatuses.Planned;
    public const string OpenStatus = "Open";
    public const string InProgressStatus = "InProgress";
    public const string DoneStatus = "Done";
    public const string CancelledStatus = "Cancelled";

    public static readonly string[] CancellableStatuses =
    [
        PlannedStatus,
        OpenStatus,
        InProgressStatus
    ];

    public static bool IsCancelled(string? status) =>
        string.Equals(status, CancelledStatus, StringComparison.OrdinalIgnoreCase);

    public static bool IsOpen(string? status) =>
        string.Equals(status, OpenStatus, StringComparison.OrdinalIgnoreCase);

    public static bool IsCancellableStatus(string? status) =>
        CancellableStatuses.Any(allowed =>
            string.Equals(status, allowed, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Generic update must not leave Cancelled via the status selector, and must not
    /// enter Cancelled without the dedicated cancellation action.
    /// </summary>
    public static string? ValidateStatusTransitionForUpdate(
        string? existingStatus,
        string? requestedStatus)
    {
        var existing = string.IsNullOrWhiteSpace(existingStatus)
            ? PlannedStatus
            : existingStatus.Trim();
        var requested = string.IsNullOrWhiteSpace(requestedStatus)
            ? existing
            : requestedStatus.Trim();

        if (IsCancelled(existing) && !IsCancelled(requested))
        {
            return "יש לפתוח מחדש את קריאת השירות באמצעות פעולת פתיחה מחדש.";
        }

        if (!IsCancelled(existing) && IsCancelled(requested))
        {
            return "יש לבטל את קריאת השירות באמצעות פעולת ביטול קריאה.";
        }

        return null;
    }

    public static bool CanCancel(string? status, DateTime? closedAt) =>
        IsCancellableStatus(status) && closedAt == null;

    public static bool CanReopen(string? status, DateTime? closedAt) =>
        IsCancelled(status) || (IsOpen(status) && closedAt != null);
}
