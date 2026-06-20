using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo;

namespace ManageR2.Infrastructure.Features.AddressProfiles;

public static class SiteOperationalFieldValidation
{
    public static void ValidateOperationalFields(string? addressLine, string? city)
    {
        if (addressLine is not null && addressLine.Length > AddressValidationConstants.SiteAddressLineMaxLength)
        {
            throw new UserValidationException(
                $"Site address line must not exceed {AddressValidationConstants.SiteAddressLineMaxLength} characters.");
        }

        if (city is not null && city.Length > AddressValidationConstants.SiteCityMaxLength)
        {
            throw new UserValidationException(
                $"Site city must not exceed {AddressValidationConstants.SiteCityMaxLength} characters.");
        }
    }
}
