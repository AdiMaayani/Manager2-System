namespace ManageR2.Domain.Features.Inventory;

public sealed record InventoryUsageLine(int InventoryItemId, decimal Quantity);

public static class InventoryUsageAggregator
{
    public static IReadOnlyDictionary<int, decimal> AggregateRequiredQuantityByItemId(
        IEnumerable<InventoryUsageLine> lines)
    {
        return lines
            .GroupBy(line => line.InventoryItemId)
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Quantity));
    }

    public static IReadOnlyDictionary<int, decimal> BuildReversalQuantitiesByItemId(
        IEnumerable<InventoryUsageLine> finalizedLines)
    {
        return AggregateRequiredQuantityByItemId(finalizedLines);
    }
}
