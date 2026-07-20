using System;
using System.Collections.Generic;

namespace ManageR2.Api.DTOs;

/// <summary>
/// Response contract for GET /api/WorkItems/{id}. Mirrors the WorkItem entity but guarantees that
/// persisted UTC timestamps serialize with an explicit UTC indication (Z suffix) so the client can
/// convert them back to Israel local time instead of reading a bare wall-clock as local time.
/// </summary>
public class WorkItemDetailResponseDto
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? WorkType { get; set; }
    public string? TaskCategory { get; set; }
    public string? BillingType { get; set; }
    public string? Status { get; set; }

    public decimal? EstimatedHours { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }

    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? RequiredRole { get; set; }
    public List<string> RequiredRoles { get; set; } = new();
    public bool IsLocked { get; set; }

    public int? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? SiteId { get; set; }
    public string? SiteName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ParentWorkItemId { get; set; }
    public int? MilestoneId { get; set; }
    public string? MilestoneTitle { get; set; }
    public string? ProjectTitle { get; set; }
    public bool IsArchived { get; set; }
    public DateTime? ArchivedAt { get; set; }

    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}
