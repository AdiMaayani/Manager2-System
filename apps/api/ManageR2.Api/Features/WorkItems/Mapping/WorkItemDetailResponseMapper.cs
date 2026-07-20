using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Features.WorkItems.Services;

namespace ManageR2.Api.Features.WorkItems.Mapping;

/// <summary>
/// Maps a WorkItem entity to the detail response DTO with explicit UTC Kind on all timestamps.
/// Follows the same pattern as ServiceCallResponseMapper: SQL DateTime values are typically
/// Unspecified and must be marked UTC (not converted through the server-local timezone).
/// </summary>
public static class WorkItemDetailResponseMapper
{
    public static WorkItemDetailResponseDto Map(WorkItem workItem)
    {
        return new WorkItemDetailResponseDto
        {
            WorkItemId = workItem.WorkItemId,
            Title = workItem.Title,
            Description = workItem.Description,
            WorkType = workItem.WorkType,
            TaskCategory = workItem.TaskCategory,
            BillingType = workItem.BillingType,
            Status = workItem.Status,
            EstimatedHours = workItem.EstimatedHours,
            ActualStart = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.ActualStart),
            ActualEnd = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.ActualEnd),
            ActualHours = workItem.ActualHours,
            Priority = workItem.Priority,
            PlannedStart = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.PlannedStart),
            PlannedEnd = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.PlannedEnd),
            RequiredRole = workItem.RequiredRole,
            RequiredRoles = workItem.RequiredRoles,
            IsLocked = workItem.IsLocked,
            CustomerId = workItem.CustomerId,
            CustomerName = workItem.CustomerName,
            SiteId = workItem.SiteId,
            SiteName = workItem.SiteName,
            CreatedAt = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.CreatedAt),
            ClosedAt = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.ClosedAt),
            ParentWorkItemId = workItem.ParentWorkItemId,
            MilestoneId = workItem.MilestoneId,
            MilestoneTitle = workItem.MilestoneTitle,
            ProjectTitle = workItem.ProjectTitle,
            IsArchived = workItem.IsArchived,
            ArchivedAt = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.ArchivedAt),
            DealCloseDate = UtcDateTimeNormalizer.MarkStoredAsUtc(workItem.DealCloseDate),
            FinanceProjectNumber = workItem.FinanceProjectNumber,
            InvoiceNumber = workItem.InvoiceNumber
        };
    }
}
