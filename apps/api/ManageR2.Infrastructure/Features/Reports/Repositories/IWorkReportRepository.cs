using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IWorkReportRepository
{
    Task<int> CreateAsync(WorkReportCreateModel request);
    Task<List<WorkReportListItemModel>> GetAllAsync();
    Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId);
    Task<bool> UpdateAsync(WorkReportUpdateModel request);
    Task<bool> DeleteAsync(int workReportId);
    Task<WorkReportLifecycleResultModel?> FinalizeAsync(int workReportId, int? finalizedByUserId);
    Task<WorkReportLifecycleResultModel?> ReverseAsync(int workReportId, string reversalReason, int? reversedByUserId);
    Task<int> AmendAsync(int reversedWorkReportId, WorkReportCreateModel request);
    Task<WorkReportInventoryLineModel?> AddInventoryLineAsync(
        int workReportId,
        int inventoryItemId,
        decimal quantity,
        string usageType,
        int? createdByUserId);
    Task<bool> DeleteInventoryLineAsync(int workReportId, int workReportInventoryItemId);
    Task<List<WorkReportInventoryLineModel>> GetInventoryLinesAsync(int workReportId);
    Task<WorkReportAttachmentModel?> AddAttachmentAsync(
        int workReportId,
        string mediaType,
        string originalFileName,
        string storedFileName,
        string filePath,
        string contentType,
        long fileSizeBytes,
        int? uploadedByUserId);
    Task<WorkReportAttachmentDeleteResultModel?> DeleteAttachmentAsync(int workReportId, int workReportAttachmentId);
    Task<List<WorkReportAttachmentModel>> GetAttachmentsAsync(int workReportId);
    Task<WorkReportAttachmentModel?> GetAttachmentAsync(int workReportId, int workReportAttachmentId);
}
