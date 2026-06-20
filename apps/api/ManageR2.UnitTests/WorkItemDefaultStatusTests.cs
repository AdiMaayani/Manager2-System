using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.UnitTests;

public class WorkItemDefaultStatusTests
{
    [Fact]
    public void Planned_IsCanonicalDefaultForNewTasks()
    {
        Assert.Equal("Planned", WorkItemDefaultStatuses.Planned);
    }
}
