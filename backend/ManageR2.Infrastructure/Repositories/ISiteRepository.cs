using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

public interface ISiteRepository
{
    Task<IEnumerable<Site>> GetAllAsync();

    Task<Site?> GetByIdAsync(int siteId);

    Task<int> CreateAsync(Site site);

    Task<bool> UpdateAsync(Site site);
}