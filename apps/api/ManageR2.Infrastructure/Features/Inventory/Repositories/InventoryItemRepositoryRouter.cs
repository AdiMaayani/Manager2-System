using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Inventory.Repositories;

// Dual-run router for the Inventory domain (Wave 4). Reads are shadow-compared; writes are dual-written
// best-effort. With default flags the router delegates purely to the SQL Server repository.
public sealed class InventoryItemRepositoryRouter : IInventoryItemRepository
{
    private readonly InventoryItemRepository _sqlServer;
    private readonly PostgresInventoryItemRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<InventoryItemRepositoryRouter> _logger;

    public InventoryItemRepositoryRouter(
        InventoryItemRepository sqlServer,
        PostgresInventoryItemRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<InventoryItemRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IInventoryItemRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<IEnumerable<InventoryItem>> GetListAsync(string? search, string? category, string? status, bool lowStockOnly)
    {
        var result = await Primary.GetListAsync(search, category, status, lowStockOnly);
        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<InventoryItem> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Inventory.GetList", materialized,
                () => _postgres.GetListAsync(search, category, status, lowStockOnly));
        }

        return result;
    }

    public async Task<InventoryItem?> GetByIdAsync(int inventoryItemId)
    {
        var result = await Primary.GetByIdAsync(inventoryItemId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Inventory.GetById", result, () => _postgres.GetByIdAsync(inventoryItemId));
        }

        return result;
    }

    public async Task<InventoryItem?> GetBySkuAsync(string skuCode)
    {
        var result = await Primary.GetBySkuAsync(skuCode);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Inventory.GetBySku", result, () => _postgres.GetBySkuAsync(skuCode));
        }

        return result;
    }

    public async Task<int> CreateAsync(InventoryItem inventoryItem)
    {
        var result = await Primary.CreateAsync(inventoryItem);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Inventory.Create", () => _postgres.CreateAsync(inventoryItem));
        }

        return result;
    }

    public async Task<int> CreateWithImageAsync(InventoryItem inventoryItem)
    {
        var result = await Primary.CreateWithImageAsync(inventoryItem);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Inventory.CreateWithImage", () => _postgres.CreateWithImageAsync(inventoryItem));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(InventoryItem inventoryItem)
    {
        var result = await Primary.UpdateAsync(inventoryItem);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Inventory.Update", () => _postgres.UpdateAsync(inventoryItem));
        }

        return result;
    }

    public async Task<bool> DeactivateAsync(int inventoryItemId)
    {
        var result = await Primary.DeactivateAsync(inventoryItemId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Inventory.Deactivate", () => _postgres.DeactivateAsync(inventoryItemId));
        }

        return result;
    }

    public async Task<InventoryImageMutationResult> SetImageAsync(
        int inventoryItemId, string imagePath, string? imageContentType, long? imageFileSizeBytes)
    {
        var result = await Primary.SetImageAsync(inventoryItemId, imagePath, imageContentType, imageFileSizeBytes);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Inventory.SetImage",
                () => _postgres.SetImageAsync(inventoryItemId, imagePath, imageContentType, imageFileSizeBytes));
        }

        return result;
    }

    public async Task<InventoryImageMutationResult> ClearImageAsync(int inventoryItemId)
    {
        var result = await Primary.ClearImageAsync(inventoryItemId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Inventory.ClearImage", () => _postgres.ClearImageAsync(inventoryItemId));
        }

        return result;
    }

    private async Task ShadowCompareAsync<T>(string operation, T primaryResult, Func<Task<T>> shadowRead)
    {
        try
        {
            _driftRecorder.RecordShadowCompared(operation);
            var shadowResult = await shadowRead();
            var comparison = _parityComparer.Compare(primaryResult, shadowResult);
            if (!comparison.IsMatch)
            {
                _driftRecorder.RecordDriftDetected(operation, comparison.DiffSummary ?? "unspecified");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Shadow read failed for {Operation}.", operation);
        }
    }

    private async Task DualWriteAsync(string operation, Func<Task> dualWrite)
    {
        try
        {
            _driftRecorder.RecordDualWriteAttempted(operation);
            await dualWrite();
        }
        catch (Exception ex)
        {
            _driftRecorder.RecordDualWriteFailed(operation, ex);
        }
    }
}
