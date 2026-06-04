using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Interfaces;

// DI abstraction for InventoryController; implementation uses dbo.sp_Inventory_* only.
public interface IInventoryItemRepository
{
    Task<IEnumerable<InventoryItem>> GetListAsync(
        string? search,
        string? category,
        string? status,
        bool lowStockOnly);

    Task<InventoryItem?> GetByIdAsync(int inventoryItemId);

    Task<int> CreateAsync(InventoryItem inventoryItem);

    Task<bool> UpdateAsync(InventoryItem inventoryItem);

    Task<bool> DeactivateAsync(int inventoryItemId);
}
