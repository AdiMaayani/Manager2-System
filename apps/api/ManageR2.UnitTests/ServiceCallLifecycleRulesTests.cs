using ManageR2.Api.Features.ServiceCalls;

namespace ManageR2.UnitTests;

public class ServiceCallLifecycleRulesTests
{
    [Fact]
    public void ValidateStatusTransition_BlocksLeavingCancelledViaUpdate()
    {
        var error = ServiceCallLifecycleRules.ValidateStatusTransitionForUpdate("Cancelled", "Open");

        Assert.NotNull(error);
        Assert.Contains("פתיחה מחדש", error);
    }

    [Fact]
    public void ValidateStatusTransition_BlocksEnteringCancelledViaUpdate()
    {
        var error = ServiceCallLifecycleRules.ValidateStatusTransitionForUpdate("Open", "Cancelled");

        Assert.NotNull(error);
        Assert.Contains("ביטול קריאה", error);
    }

    [Fact]
    public void ValidateStatusTransition_AllowsOrdinaryStatusChanges()
    {
        Assert.Null(ServiceCallLifecycleRules.ValidateStatusTransitionForUpdate("Open", "InProgress"));
        Assert.Null(ServiceCallLifecycleRules.ValidateStatusTransitionForUpdate("Planned", "Planned"));
        Assert.Null(ServiceCallLifecycleRules.ValidateStatusTransitionForUpdate("Cancelled", "Cancelled"));
    }

    [Theory]
    [InlineData("Planned")]
    [InlineData("Open")]
    [InlineData("InProgress")]
    public void CanCancel_AllowsActiveStatusesWithoutClosedAt(string status)
    {
        Assert.True(ServiceCallLifecycleRules.CanCancel(status, null));
    }

    [Fact]
    public void CanCancel_RejectsDone()
    {
        Assert.False(ServiceCallLifecycleRules.CanCancel("Done", null));
    }

    [Fact]
    public void CanCancel_RejectsCancelled()
    {
        Assert.False(ServiceCallLifecycleRules.CanCancel("Cancelled", DateTime.UtcNow));
        Assert.False(ServiceCallLifecycleRules.CanCancel("Cancelled", null));
    }

    [Fact]
    public void CanReopen_AllowsCancelled()
    {
        Assert.True(ServiceCallLifecycleRules.CanReopen("Cancelled", DateTime.UtcNow));
        Assert.True(ServiceCallLifecycleRules.CanReopen("Cancelled", null));
    }

    [Fact]
    public void CanReopen_AllowsOpenWithStaleClosedAt()
    {
        Assert.True(ServiceCallLifecycleRules.CanReopen("Open", DateTime.UtcNow));
    }

    [Theory]
    [InlineData("Done")]
    [InlineData("InProgress")]
    [InlineData("Planned")]
    public void CanReopen_RejectsNonOpenActiveStatusesEvenWithClosedAt(string status)
    {
        Assert.False(ServiceCallLifecycleRules.CanReopen(status, DateTime.UtcNow));
    }

    [Fact]
    public void CanReopen_RejectsOpenWithoutClosedAt()
    {
        Assert.False(ServiceCallLifecycleRules.CanReopen("Open", null));
    }
}
