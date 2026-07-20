using System.Globalization;
using FluentValidation;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Features.Reports;

namespace ManageR2.Api.Features.Reports.Validators;

public sealed class CreateWorkReportRequestValidator : AbstractValidator<CreateWorkReportRequest>
{
    public CreateWorkReportRequestValidator()
    {
        RuleFor(request => request.Date)
            .NotEmpty().WithMessage("יש להזין תאריך דיווח.")
            .Must(BeValidReportDate).WithMessage("תאריך הדיווח אינו תקין.");

        RuleFor(request => request.ReportType)
            .NotEmpty().WithMessage("סוג הדיווח אינו תקין.")
            .Must(WorkReportReportTypes.IsKnown).WithMessage("סוג הדיווח אינו תקין.");

        RuleFor(request => request.Status)
            .NotEmpty().WithMessage("סטטוס הדיווח אינו תקין.")
            .Must(BeKnownWorkflowStatus).WithMessage("סטטוס הדיווח אינו תקין.");

        RuleFor(request => request)
            .Must(request => !IsRegularReport(request) || !request.ProjectId.HasValue || request.ProjectId.Value <= 0)
            .WithMessage("דיווח על משימה כללית אינו יכול לכלול הקשר פרויקט.");

        When(IsDraftStatus, () =>
        {
            RuleFor(request => request)
                .Must(request => !HasPartialTimeRange(request) || HasValidTimeRange(request))
                .WithMessage("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
        });

        When(IsSubmittedStatus, () =>
        {
            RuleFor(request => request)
                .Must(HasLinkedWorkItem)
                .WithMessage("יש לבחור משימה או קריאת שירות.");

            RuleFor(request => request)
                .Must(request => !IsProjectReport(request) || HasLinkedWorkItem(request))
                .WithMessage("דיווח על משימת פרויקט דורש משימה מקושרת.");

            RuleFor(request => request)
                .Must(request => !IsServiceCallReport(request)
                    || request.ServiceCallId > 0
                    || request.WorkItemId > 0)
                .WithMessage("דיווח על קריאת שירות דורש קריאת שירות מקושרת.");

            RuleFor(request => request.ReporterId)
                .NotNull().WithMessage("יש לבחור מדווח.")
                .GreaterThan(0).WithMessage("יש לבחור מדווח.");

            RuleFor(request => request.Start)
                .NotEmpty().WithMessage("יש להזין שעות עבודה.");

            RuleFor(request => request.End)
                .NotEmpty().WithMessage("יש להזין שעות עבודה.");

            RuleFor(request => request)
                .Must(HasValidTimeRange)
                .WithMessage("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");

            RuleFor(request => request.Summary)
                .Must(summary => !string.IsNullOrWhiteSpace(summary))
                .WithMessage("יש להזין סיכום עבודה.");
        });
    }

    private static bool IsDraftStatus(CreateWorkReportRequest request) =>
        string.Equals(request.Status, WorkReportWorkflowStatuses.Draft, StringComparison.Ordinal);

    private static bool IsSubmittedStatus(CreateWorkReportRequest request) =>
        string.Equals(request.Status, WorkReportWorkflowStatuses.Submitted, StringComparison.Ordinal)
        || string.Equals(request.Status, WorkReportWorkflowStatuses.TransferredToAccounting, StringComparison.Ordinal);

    private static bool BeKnownWorkflowStatus(string? status) =>
        string.Equals(status, WorkReportWorkflowStatuses.Draft, StringComparison.Ordinal)
        || string.Equals(status, WorkReportWorkflowStatuses.Submitted, StringComparison.Ordinal)
        || string.Equals(status, WorkReportWorkflowStatuses.TransferredToAccounting, StringComparison.Ordinal);

    private static bool BeValidReportDate(string? date) =>
        !string.IsNullOrWhiteSpace(date) && TryParseReportDate(date, out _);

    private static bool TryParseReportDate(string date, out DateTime parsedDate)
    {
        if (DateTime.TryParseExact(
                date.Trim(),
                new[] { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ss.fff", "yyyy-MM-ddTHH:mm:ssZ" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out parsedDate))
        {
            return true;
        }

        return DateTime.TryParse(
            date,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces,
            out parsedDate);
    }

    private static bool HasLinkedWorkItem(CreateWorkReportRequest request) =>
        request.WorkItemId > 0
        || request.ProjectId > 0
        || request.ServiceCallId > 0;

    private static bool HasPartialTimeRange(CreateWorkReportRequest request) =>
        !string.IsNullOrWhiteSpace(request.Start) && !string.IsNullOrWhiteSpace(request.End);

    private static bool HasValidTimeRange(CreateWorkReportRequest request)
    {
        if (!TryParseReportTime(request.Start, out var start)
            || !TryParseReportTime(request.End, out var end))
        {
            return false;
        }

        return end > start;
    }

    private static bool TryParseReportTime(string? value, out TimeSpan time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return TimeSpan.TryParseExact(
                   value.Trim(),
                   new[] { @"hh\:mm", @"hh\:mm\:ss", @"h\:mm", @"h\:mm\:ss" },
                   CultureInfo.InvariantCulture,
                   out time)
               || TimeSpan.TryParse(value, CultureInfo.InvariantCulture, out time);
    }

    private static bool IsRegularReport(CreateWorkReportRequest request) =>
        string.Equals(request.ReportType, WorkReportReportTypes.Regular, StringComparison.OrdinalIgnoreCase);

    private static bool IsProjectReport(CreateWorkReportRequest request) =>
        string.Equals(request.ReportType, WorkReportReportTypes.Project, StringComparison.OrdinalIgnoreCase);

    private static bool IsServiceCallReport(CreateWorkReportRequest request) =>
        string.Equals(request.ReportType, WorkReportReportTypes.ServiceCall, StringComparison.OrdinalIgnoreCase);
}
