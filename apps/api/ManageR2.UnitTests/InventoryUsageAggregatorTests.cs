using ManageR2.Domain.Features.Inventory;

namespace ManageR2.UnitTests;

public class InventoryUsageAggregatorTests
{
    [Fact]
    public void AggregateRequiredQuantityByItemId_SumsAcrossUsageTypes()
    {
        var lines = new[]
        {
            new InventoryUsageLine(10, 2m),
            new InventoryUsageLine(10, 3m),
            new InventoryUsageLine(20, 1m)
        };

        var aggregated = InventoryUsageAggregator.AggregateRequiredQuantityByItemId(lines);

        Assert.Equal(5m, aggregated[10]);
        Assert.Equal(1m, aggregated[20]);
    }

    [Fact]
    public void BuildReversalQuantitiesByItemId_MatchesFinalizeAggregation()
    {
        var lines = new[]
        {
            new InventoryUsageLine(5, 4m),
            new InventoryUsageLine(5, 1.5m)
        };

        var reversal = InventoryUsageAggregator.BuildReversalQuantitiesByItemId(lines);

        Assert.Equal(5.5m, reversal[5]);
    }
}
