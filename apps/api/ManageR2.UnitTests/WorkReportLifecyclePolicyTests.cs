using ManageR2.Domain.Features.Reports;

namespace ManageR2.UnitTests;

public class WorkReportLifecyclePolicyTests
{
    [Theory]
    [InlineData(WorkReportLifecycleStatuses.Draft, true, true, true, true, false, false)]
    [InlineData(WorkReportLifecycleStatuses.Finalized, false, true, true, false, true, false)]
    [InlineData(WorkReportLifecycleStatuses.Reversed, false, false, false, false, false, true)]
    public void Policy_EnforcesLifecycleEditabilityRules(
        string lifecycleStatus,
        bool canEditInventory,
        bool canEditAttachments,
        bool canEditText,
        bool canFinalize,
        bool canReverse,
        bool isReadOnly)
    {
        Assert.Equal(canEditInventory, WorkReportLifecyclePolicy.CanEditInventory(lifecycleStatus));
        Assert.Equal(canEditAttachments, WorkReportLifecyclePolicy.CanEditAttachments(lifecycleStatus));
        Assert.Equal(canEditText, WorkReportLifecyclePolicy.CanEditTextualFields(lifecycleStatus));
        Assert.Equal(canFinalize, WorkReportLifecyclePolicy.CanFinalize(lifecycleStatus));
        Assert.Equal(canReverse, WorkReportLifecyclePolicy.CanReverse(lifecycleStatus));
        Assert.Equal(isReadOnly, WorkReportLifecyclePolicy.IsReadOnly(lifecycleStatus));
    }

    [Theory]
    [InlineData(WorkReportLifecycleStatuses.Reversed, true)]
    [InlineData(WorkReportLifecycleStatuses.Draft, false)]
    [InlineData(WorkReportLifecycleStatuses.Finalized, false)]
    public void Policy_AllowsAmendOnlyFromReversed(string lifecycleStatus, bool canAmend)
    {
        Assert.Equal(canAmend, WorkReportLifecyclePolicy.CanAmend(lifecycleStatus));
    }
}
