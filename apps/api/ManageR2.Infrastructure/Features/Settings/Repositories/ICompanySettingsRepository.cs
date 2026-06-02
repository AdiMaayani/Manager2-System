using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

// Persistence contract for the single-row company profile used by Settings.
public interface ICompanySettingsRepository
{
    Task<CompanySettings?> GetCompanySettingsAsync();

    Task<CompanySettings> UpsertCompanySettingsAsync(CompanySettings companySettings);
}
