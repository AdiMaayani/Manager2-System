using ManageR2.Domain.Features.Geo;
using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;

namespace ManageR2.Infrastructure.Features.AddressProfiles.Services;

public class AddressProfileService : IAddressProfileService
{
    private readonly IEmployeeBaseAddressRepository _employeeBaseAddressRepository;
    private readonly ISiteAddressProfileRepository _siteAddressProfileRepository;

    public AddressProfileService(
        IEmployeeBaseAddressRepository employeeBaseAddressRepository,
        ISiteAddressProfileRepository siteAddressProfileRepository)
    {
        _employeeBaseAddressRepository = employeeBaseAddressRepository;
        _siteAddressProfileRepository = siteAddressProfileRepository;
    }

    public Task<AddressProfile?> GetEmployeeBaseAddressAsync(int employeeId)
    {
        return _employeeBaseAddressRepository.GetByEmployeeIdAsync(employeeId);
    }

    public async Task<AddressProfile> UpsertEmployeeBaseAddressAsync(int employeeId, AddressProfile incoming)
    {
        incoming.OwnerId = employeeId;
        var existing = await _employeeBaseAddressRepository.GetByEmployeeIdAsync(employeeId);
        incoming = AddressProfileValidationRules.ApplyStaleIfTextChanged(existing, incoming);
        AddressProfileValidationRules.ValidatePersistedProfile(incoming);

        return await _employeeBaseAddressRepository.UpsertAsync(incoming);
    }

    public Task<AddressProfile?> GetSiteAddressProfileAsync(int siteId)
    {
        return _siteAddressProfileRepository.GetBySiteIdAsync(siteId);
    }

    public async Task<SiteWithAddressProfileRecord> SaveSiteWithAddressProfileAsync(SiteWithAddressProfileRecord request)
    {
        request.HasAddressProfile = request.Profile is not null;

        if (request.HasAddressProfile)
        {
            var existingProfile = request.SiteId.HasValue && request.SiteId.Value > 0
                ? await _siteAddressProfileRepository.GetBySiteIdAsync(request.SiteId.Value)
                : null;

            request.Profile = AddressProfileValidationRules.ApplyStaleIfTextChanged(existingProfile, request.Profile!);
            AddressProfileValidationRules.ValidatePersistedProfile(request.Profile);

            request.AddressLine = BuildOperationalAddressLine(request.Profile);
            request.City = request.Profile.City ?? request.City;
        }

        SiteOperationalFieldValidation.ValidateOperationalFields(request.AddressLine, request.City);

        return await _siteAddressProfileRepository.SaveSiteWithAddressProfileAsync(request);
    }

    private static string? BuildOperationalAddressLine(AddressProfile profile)
    {
        if (!string.IsNullOrWhiteSpace(profile.Street))
        {
            return string.IsNullOrWhiteSpace(profile.HouseNumber)
                ? profile.Street
                : $"{profile.Street} {profile.HouseNumber}";
        }

        return profile.FormattedAddress ?? profile.InputAddress;
    }
}
