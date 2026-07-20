namespace ManageR2.Domain.Features.Reports;

public static class WorkReportReportTypes
{
    public const string Regular = "regular";
    public const string Project = "project";
    public const string ServiceCall = "service_call";

    public static bool IsKnown(string? reportType) =>
        string.Equals(reportType, Regular, StringComparison.OrdinalIgnoreCase)
        || string.Equals(reportType, Project, StringComparison.OrdinalIgnoreCase)
        || string.Equals(reportType, ServiceCall, StringComparison.OrdinalIgnoreCase);
}
