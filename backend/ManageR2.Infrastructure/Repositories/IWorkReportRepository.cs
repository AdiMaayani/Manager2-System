using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IWorkReportRepository
{
    Task<int> CreateAsync(WorkReportCreateModel request);
}