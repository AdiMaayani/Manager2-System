using System.Text.Json;
using ManageR2.Api.Features.WorkItems.Mapping;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.UnitTests;

public class WorkItemDetailResponseMapperTests
{
    [Fact]
    public void Map_MarksUnspecifiedTimestampsAsUtcWithoutShifting()
    {
        var workItem = new WorkItem
        {
            WorkItemId = 42,
            Title = "Task",
            WorkType = WorkItemWorkTypes.Task,
            TaskCategory = WorkItemTaskCategories.Regular,
            Status = "Planned",
            PlannedStart = new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Unspecified),
            PlannedEnd = new DateTime(2026, 7, 20, 15, 50, 0, DateTimeKind.Unspecified),
            ActualStart = new DateTime(2026, 7, 20, 12, 0, 0, DateTimeKind.Unspecified),
            ActualEnd = new DateTime(2026, 7, 20, 16, 0, 0, DateTimeKind.Unspecified),
            CreatedAt = new DateTime(2026, 6, 1, 8, 15, 0, DateTimeKind.Unspecified),
            ClosedAt = new DateTime(2026, 7, 25, 9, 0, 0, DateTimeKind.Unspecified)
        };

        var dto = WorkItemDetailResponseMapper.Map(workItem);

        Assert.Equal(DateTimeKind.Utc, dto.PlannedStart!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.PlannedEnd!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.ActualStart!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.ActualEnd!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.CreatedAt.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.ClosedAt!.Value.Kind);

        // Wall-clock is only re-labelled, never converted.
        Assert.Equal(workItem.PlannedStart.Value.Ticks, dto.PlannedStart.Value.Ticks);
        Assert.Equal(workItem.CreatedAt.Ticks, dto.CreatedAt.Ticks);
    }

    [Fact]
    public void Map_KeepsNullableTimestampsNull()
    {
        var workItem = new WorkItem
        {
            WorkItemId = 7,
            Title = "Task",
            WorkType = WorkItemWorkTypes.Task,
            CreatedAt = new DateTime(2026, 6, 1, 8, 15, 0, DateTimeKind.Unspecified)
        };

        var dto = WorkItemDetailResponseMapper.Map(workItem);

        Assert.Null(dto.PlannedStart);
        Assert.Null(dto.PlannedEnd);
        Assert.Null(dto.ActualStart);
        Assert.Null(dto.ActualEnd);
        Assert.Null(dto.ClosedAt);
        Assert.Null(dto.ArchivedAt);
        Assert.Null(dto.DealCloseDate);
    }

    [Fact]
    public void Map_DoesNotShiftTimestampsAlreadyMarkedUtc()
    {
        var utcStart = new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Utc);
        var workItem = new WorkItem
        {
            WorkItemId = 9,
            Title = "Task",
            WorkType = WorkItemWorkTypes.Task,
            PlannedStart = utcStart,
            PlannedEnd = utcStart.AddHours(4),
            CreatedAt = utcStart
        };

        var dto = WorkItemDetailResponseMapper.Map(workItem);

        Assert.Equal(utcStart, dto.PlannedStart!.Value);
        Assert.Equal(DateTimeKind.Utc, dto.PlannedStart.Value.Kind);
    }

    [Fact]
    public void Map_JsonSerializationEmitsZForEveryNonNullTimestamp()
    {
        var workItem = new WorkItem
        {
            WorkItemId = 42,
            Title = "Task",
            WorkType = WorkItemWorkTypes.Task,
            TaskCategory = WorkItemTaskCategories.Regular,
            Status = "Planned",
            PlannedStart = new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Unspecified),
            PlannedEnd = new DateTime(2026, 7, 20, 15, 50, 0, DateTimeKind.Unspecified),
            ActualStart = new DateTime(2026, 7, 20, 12, 0, 0, DateTimeKind.Unspecified),
            ActualEnd = new DateTime(2026, 7, 20, 16, 0, 0, DateTimeKind.Unspecified),
            CreatedAt = new DateTime(2026, 6, 1, 8, 15, 0, DateTimeKind.Unspecified),
            ClosedAt = new DateTime(2026, 7, 25, 9, 0, 0, DateTimeKind.Unspecified),
            IsArchived = true,
            ArchivedAt = new DateTime(2026, 7, 26, 10, 30, 0, DateTimeKind.Unspecified),
            DealCloseDate = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Unspecified)
        };

        var dto = WorkItemDetailResponseMapper.Map(workItem);
        var json = JsonSerializer.Serialize(
            dto,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        using var document = JsonDocument.Parse(json);
        AssertPropertyEndsWithZ(document.RootElement, "plannedStart");
        AssertPropertyEndsWithZ(document.RootElement, "plannedEnd");
        AssertPropertyEndsWithZ(document.RootElement, "actualStart");
        AssertPropertyEndsWithZ(document.RootElement, "actualEnd");
        AssertPropertyEndsWithZ(document.RootElement, "createdAt");
        AssertPropertyEndsWithZ(document.RootElement, "closedAt");
        AssertPropertyEndsWithZ(document.RootElement, "archivedAt");
        AssertPropertyEndsWithZ(document.RootElement, "dealCloseDate");

        // The wall-clock must be emitted as UTC, not shifted through a server-local timezone.
        Assert.StartsWith(
            "2026-07-20T11:50:00",
            document.RootElement.GetProperty("plannedStart").GetString(),
            StringComparison.Ordinal);
    }

    private static void AssertPropertyEndsWithZ(JsonElement root, string propertyName)
    {
        var raw = root.GetProperty(propertyName).GetString();
        Assert.False(string.IsNullOrWhiteSpace(raw));
        Assert.EndsWith("Z", raw, StringComparison.Ordinal);
    }
}
