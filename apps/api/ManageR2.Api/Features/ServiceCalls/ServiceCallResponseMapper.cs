using ManageR2.Api.Features.ServiceCalls.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Services;

namespace ManageR2.Api.Features.ServiceCalls;

/// <summary>
/// Maps a Service Call WorkItem to the API response DTO with explicit UTC Kind on all timestamps.
/// </summary>
public static class ServiceCallResponseMapper
{
    public static ServiceCallResponseDto Map(WorkItem serviceCall)
    {
        return new ServiceCallResponseDto
        {
            WorkItemId = serviceCall.WorkItemId,
            Title = serviceCall.Title,
            Description = serviceCall.Description,
            WorkType = serviceCall.WorkType ?? WorkItemWorkTypes.ServiceCall,
            TaskCategory = serviceCall.TaskCategory,
            Status = serviceCall.Status ?? string.Empty,
            BillingType = serviceCall.BillingType,
            CustomerId = serviceCall.CustomerId,
            CustomerName = serviceCall.CustomerName,
            SiteId = serviceCall.SiteId,
            SiteName = serviceCall.SiteName,
            Priority = serviceCall.Priority,
            PlannedStart = UtcDateTimeNormalizer.MarkStoredAsUtc(serviceCall.PlannedStart),
            PlannedEnd = UtcDateTimeNormalizer.MarkStoredAsUtc(serviceCall.PlannedEnd),
            EstimatedHours = serviceCall.EstimatedHours,
            ActualStart = UtcDateTimeNormalizer.MarkStoredAsUtc(serviceCall.ActualStart),
            ActualEnd = UtcDateTimeNormalizer.MarkStoredAsUtc(serviceCall.ActualEnd),
            ActualHours = serviceCall.ActualHours,
            RequiredRole = serviceCall.RequiredRole,
            IsLocked = serviceCall.IsLocked,
            CreatedAt = UtcDateTimeNormalizer.MarkStoredAsUtc(serviceCall.CreatedAt),
            ClosedAt = UtcDateTimeNormalizer.MarkStoredAsUtc(serviceCall.ClosedAt)
        };
    }
}
