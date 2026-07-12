using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Reports.Repositories;

// Dual-run router for the Reports domain (Wave 4). Reads are shadow-compared; writes — including the
// transactional lifecycle finalize/reverse (which orchestrates the inventory ledger) — are dual-written
// best-effort. With default flags the router delegates purely to the SQL Server repository.
public sealed class WorkReportRepositoryRouter : IWorkReportRepository
{
    private readonly WorkReportRepository _sqlServer;
    private readonly PostgresWorkReportRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<WorkReportRepositoryRouter> _logger;

    public WorkReportRepositoryRouter(
        WorkReportRepository sqlServer,
        PostgresWorkReportRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<WorkReportRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IWorkReportRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<List<WorkReportListItemModel>> GetAllAsync()
    {
        var result = await Primary.GetAllAsync();
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkReports.GetAll", result, () => _postgres.GetAllAsync());
        }

        return result;
    }

    public async Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId)
    {
        var result = await Primary.GetByIdAsync(workReportId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkReports.GetById", result, () => _postgres.GetByIdAsync(workReportId));
        }

        return result;
    }

    public async Task<List<WorkReportInventoryLineModel>> GetInventoryLinesAsync(int workReportId)
    {
        var result = await Primary.GetInventoryLinesAsync(workReportId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkReports.GetInventoryLines", result,
                () => _postgres.GetInventoryLinesAsync(workReportId));
        }

        return result;
    }

    public async Task<List<WorkReportAttachmentModel>> GetAttachmentsAsync(int workReportId)
    {
        var result = await Primary.GetAttachmentsAsync(workReportId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkReports.GetAttachments", result,
                () => _postgres.GetAttachmentsAsync(workReportId));
        }

        return result;
    }

    public async Task<WorkReportAttachmentModel?> GetAttachmentAsync(int workReportId, int workReportAttachmentId)
    {
        var result = await Primary.GetAttachmentAsync(workReportId, workReportAttachmentId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkReports.GetAttachment", result,
                () => _postgres.GetAttachmentAsync(workReportId, workReportAttachmentId));
        }

        return result;
    }

    public async Task<int> CreateAsync(WorkReportCreateModel request)
    {
        var result = await Primary.CreateAsync(request);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.Create", () => _postgres.CreateAsync(request));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(WorkReportUpdateModel request)
    {
        var result = await Primary.UpdateAsync(request);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.Update", () => _postgres.UpdateAsync(request));
        }

        return result;
    }

    public async Task<bool> DeleteAsync(int workReportId)
    {
        var result = await Primary.DeleteAsync(workReportId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.Delete", () => _postgres.DeleteAsync(workReportId));
        }

        return result;
    }

    public async Task<WorkReportLifecycleResultModel?> FinalizeAsync(int workReportId, int? finalizedByUserId)
    {
        var result = await Primary.FinalizeAsync(workReportId, finalizedByUserId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.Finalize", () => _postgres.FinalizeAsync(workReportId, finalizedByUserId));
        }

        return result;
    }

    public async Task<WorkReportLifecycleResultModel?> ReverseAsync(
        int workReportId, string reversalReason, int? reversedByUserId)
    {
        var result = await Primary.ReverseAsync(workReportId, reversalReason, reversedByUserId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.Reverse",
                () => _postgres.ReverseAsync(workReportId, reversalReason, reversedByUserId));
        }

        return result;
    }

    public async Task<int> AmendAsync(int reversedWorkReportId, WorkReportCreateModel request)
    {
        var result = await Primary.AmendAsync(reversedWorkReportId, request);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.Amend", () => _postgres.AmendAsync(reversedWorkReportId, request));
        }

        return result;
    }

    public async Task<WorkReportInventoryLineModel?> AddInventoryLineAsync(
        int workReportId, int inventoryItemId, decimal quantity, string usageType, int? createdByUserId)
    {
        var result = await Primary.AddInventoryLineAsync(workReportId, inventoryItemId, quantity, usageType, createdByUserId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.AddInventoryLine",
                () => _postgres.AddInventoryLineAsync(workReportId, inventoryItemId, quantity, usageType, createdByUserId));
        }

        return result;
    }

    public async Task<bool> DeleteInventoryLineAsync(int workReportId, int workReportInventoryItemId)
    {
        var result = await Primary.DeleteInventoryLineAsync(workReportId, workReportInventoryItemId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.DeleteInventoryLine",
                () => _postgres.DeleteInventoryLineAsync(workReportId, workReportInventoryItemId));
        }

        return result;
    }

    public async Task<WorkReportAttachmentModel?> AddAttachmentAsync(
        int workReportId,
        string mediaType,
        string originalFileName,
        string storedFileName,
        string filePath,
        string contentType,
        long fileSizeBytes,
        int? uploadedByUserId)
    {
        var result = await Primary.AddAttachmentAsync(
            workReportId, mediaType, originalFileName, storedFileName, filePath, contentType, fileSizeBytes, uploadedByUserId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.AddAttachment", () => _postgres.AddAttachmentAsync(
                workReportId, mediaType, originalFileName, storedFileName, filePath, contentType, fileSizeBytes, uploadedByUserId));
        }

        return result;
    }

    public async Task<WorkReportAttachmentDeleteResultModel?> DeleteAttachmentAsync(
        int workReportId, int workReportAttachmentId)
    {
        var result = await Primary.DeleteAttachmentAsync(workReportId, workReportAttachmentId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkReports.DeleteAttachment",
                () => _postgres.DeleteAttachmentAsync(workReportId, workReportAttachmentId));
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
