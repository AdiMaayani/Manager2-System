using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

// ReportsController boundary: create uses WorkReportCreateModel; reads return list/detail infrastructure models.
// Repository contract for creating and reading work reports linked to work items.
public interface IWorkReportRepository
{
    Task<int> CreateAsync(WorkReportCreateModel request);
    Task<List<WorkReportListItemModel>> GetAllAsync();
    Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId);
}