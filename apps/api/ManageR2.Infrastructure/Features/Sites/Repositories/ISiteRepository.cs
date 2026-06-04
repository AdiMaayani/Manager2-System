using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

// Site CRUD contract used by SitesController and SiteRepository ADO implementation.
public interface ISiteRepository
{
    Task<IEnumerable<Site>> GetAllAsync();

    Task<Site?> GetByIdAsync(int siteId);

    Task<int> CreateAsync(Site site);

    Task<bool> UpdateAsync(Site site);

    Task<bool> DeactivateAsync(int siteId);
}