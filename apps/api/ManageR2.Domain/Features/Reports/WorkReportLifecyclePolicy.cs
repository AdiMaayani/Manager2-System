namespace ManageR2.Domain.Features.Reports;

public static class WorkReportLifecyclePolicy
{
    public static bool CanEditInventory(string? lifecycleStatus) =>
        string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Draft, StringComparison.Ordinal);

    public static bool CanEditAttachments(string? lifecycleStatus) =>
        string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Draft, StringComparison.Ordinal)
        || string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Finalized, StringComparison.Ordinal);

    public static bool CanEditTextualFields(string? lifecycleStatus) =>
        CanEditAttachments(lifecycleStatus);

    public static bool CanFinalize(string? lifecycleStatus) =>
        string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Draft, StringComparison.Ordinal);

    public static bool CanReverse(string? lifecycleStatus) =>
        string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Finalized, StringComparison.Ordinal);

    public static bool CanAmend(string? lifecycleStatus) =>
        string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Reversed, StringComparison.Ordinal);

    public static bool IsReadOnly(string? lifecycleStatus) =>
        string.Equals(lifecycleStatus, WorkReportLifecycleStatuses.Reversed, StringComparison.Ordinal);
}
