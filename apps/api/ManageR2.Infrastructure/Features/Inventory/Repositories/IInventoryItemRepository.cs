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

    // Sets/replaces the stored image metadata. Reports whether the item existed and the previously
    // stored relative path (if any) so the caller can delete the replaced file.
    Task<InventoryImageMutationResult> SetImageAsync(int inventoryItemId, string imagePath, string? imageContentType, long? imageFileSizeBytes);

    // Clears the stored image metadata. Reports whether a row was cleared and the previously stored
    // relative path (if any) so the caller can delete the file.
    Task<InventoryImageMutationResult> ClearImageAsync(int inventoryItemId);
}
