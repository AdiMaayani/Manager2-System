using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IWorkReportRepository
{
    Task<int> CreateAsync(WorkReportCreateModel request);
    Task<List<WorkReportListItemModel>> GetAllAsync();
    Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId);
}