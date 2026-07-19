using System.Text.Json;
using ManageR2.Api.Features.ServiceCalls;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.UnitTests;

public class ServiceCallResponseMapperTests
{
    [Fact]
    public void Map_MarksUnspecifiedOperationalTimestampsAsUtc()
    {
        var workItem = CreateServiceCallWorkItem(
            plannedStart: new DateTime(2026, 7, 19, 9, 33, 0, DateTimeKind.Unspecified),
            plannedEnd: new DateTime(2026, 7, 19, 11, 33, 0, DateTimeKind.Unspecified),
            actualStart: new DateTime(2026, 7, 19, 9, 40, 0, DateTimeKind.Unspecified),
            actualEnd: new DateTime(2026, 7, 19, 11, 40, 0, DateTimeKind.Unspecified),
            createdAt: new DateTime(2026, 6, 19, 17, 27, 16, DateTimeKind.Unspecified),
            closedAt: new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Unspecified));

        var dto = ServiceCallResponseMapper.Map(workItem);

        AssertUtcInstant(dto.PlannedStart, 2026, 7, 19, 9, 33, 0);
        AssertUtcInstant(dto.PlannedEnd, 2026, 7, 19, 11, 33, 0);
        AssertUtcInstant(dto.ActualStart, 2026, 7, 19, 9, 40, 0);
        AssertUtcInstant(dto.ActualEnd, 2026, 7, 19, 11, 40, 0);
        Assert.Equal(DateTimeKind.Utc, dto.CreatedAt.Kind);
        Assert.Equal(workItem.CreatedAt.Ticks, dto.CreatedAt.Ticks);
        AssertUtcInstant(dto.ClosedAt, 2026, 7, 20, 8, 0, 0);
    }

    [Fact]
    public void Map_KeepsNullOptionalTimestampsNull()
    {
        var workItem = CreateServiceCallWorkItem(
            plannedStart: null,
            plannedEnd: null,
            actualStart: null,
            actualEnd: null,
            createdAt: new DateTime(2026, 6, 19, 17, 27, 16, DateTimeKind.Unspecified),
            closedAt: null);

        var dto = ServiceCallResponseMapper.Map(workItem);

        Assert.Null(dto.PlannedStart);
        Assert.Null(dto.PlannedEnd);
        Assert.Null(dto.ActualStart);
        Assert.Null(dto.ActualEnd);
        Assert.Null(dto.ClosedAt);
        Assert.Equal(DateTimeKind.Utc, dto.CreatedAt.Kind);
    }

    [Fact]
    public void Map_PreservesAlreadyUtcInstantAndKind()
    {
        var plannedStart = new DateTime(2026, 7, 19, 9, 33, 0, DateTimeKind.Utc);
        var workItem = CreateServiceCallWorkItem(
            plannedStart: plannedStart,
            plannedEnd: plannedStart.AddHours(2),
            actualStart: null,
            actualEnd: null,
            createdAt: plannedStart.AddDays(-1),
            closedAt: null);

        var dto = ServiceCallResponseMapper.Map(workItem);

        Assert.Equal(plannedStart, dto.PlannedStart);
        Assert.Equal(DateTimeKind.Utc, dto.PlannedStart!.Value.Kind);
    }

    [Fact]
    public void Map_JsonSerializationEmitsZForEveryNonNullTimestamp()
    {
        var workItem = CreateServiceCallWorkItem(
            plannedStart: new DateTime(2026, 7, 19, 9, 33, 0, DateTimeKind.Unspecified),
            plannedEnd: new DateTime(2026, 7, 19, 11, 33, 0, DateTimeKind.Unspecified),
            actualStart: new DateTime(2026, 7, 19, 9, 40, 0, DateTimeKind.Unspecified),
            actualEnd: new DateTime(2026, 7, 19, 11, 40, 0, DateTimeKind.Unspecified),
            createdAt: new DateTime(2026, 6, 19, 17, 27, 16, DateTimeKind.Unspecified),
            closedAt: new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Unspecified));

        var dto = ServiceCallResponseMapper.Map(workItem);
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
    }

    private static WorkItem CreateServiceCallWorkItem(
        DateTime? plannedStart,
        DateTime? plannedEnd,
        DateTime? actualStart,
        DateTime? actualEnd,
        DateTime createdAt,
        DateTime? closedAt)
    {
        return new WorkItem
        {
            WorkItemId = 42,
            Title = "תקלת רשת",
            WorkType = WorkItemWorkTypes.ServiceCall,
            Status = "Open",
            CustomerId = 7,
            SiteId = 13,
            PlannedStart = plannedStart,
            PlannedEnd = plannedEnd,
            ActualStart = actualStart,
            ActualEnd = actualEnd,
            CreatedAt = createdAt,
            ClosedAt = closedAt,
            IsLocked = false
        };
    }

    private static void AssertUtcInstant(
        DateTime? value,
        int year,
        int month,
        int day,
        int hour,
        int minute,
        int second)
    {
        Assert.NotNull(value);
        Assert.Equal(DateTimeKind.Utc, value.Value.Kind);
        Assert.Equal(new DateTime(year, month, day, hour, minute, second, DateTimeKind.Utc), value.Value);
    }

    private static void AssertPropertyEndsWithZ(JsonElement root, string propertyName)
    {
        var raw = root.GetProperty(propertyName).GetString();
        Assert.False(string.IsNullOrWhiteSpace(raw));
        Assert.EndsWith("Z", raw, StringComparison.Ordinal);
    }
}
