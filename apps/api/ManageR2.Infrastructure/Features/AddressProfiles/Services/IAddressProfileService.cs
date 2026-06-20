using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;

namespace ManageR2.Infrastructure.Features.AddressProfiles.Services;

public interface IAddressProfileService
{
    Task<AddressProfile?> GetEmployeeBaseAddressAsync(int employeeId);
    Task<AddressProfile> UpsertEmployeeBaseAddressAsync(int employeeId, AddressProfile incoming);
    Task<AddressProfile?> GetSiteAddressProfileAsync(int siteId);
    Task<SiteWithAddressProfileRecord> SaveSiteWithAddressProfileAsync(SiteWithAddressProfileRecord request);
}
