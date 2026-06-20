using ManageR2.Domain.Features.Geo.Entities;

namespace ManageR2.Infrastructure.Features.AddressProfiles.Repositories;

public interface IEmployeeBaseAddressRepository
{
    Task<AddressProfile?> GetByEmployeeIdAsync(int employeeId);
    Task<AddressProfile> UpsertAsync(AddressProfile profile);
    Task InvalidateRoutesByEmployeeIdAsync(int employeeId);
}
