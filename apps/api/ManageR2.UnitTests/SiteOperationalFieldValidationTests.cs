using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo;
using ManageR2.Infrastructure.Features.AddressProfiles;

namespace ManageR2.UnitTests;

public class SiteOperationalFieldValidationTests
{
    [Fact]
    public void ValidateOperationalFields_AllowsValuesWithinLimits()
    {
        var exception = Record.Exception(() =>
            SiteOperationalFieldValidation.ValidateOperationalFields(
                new string('a', AddressValidationConstants.SiteAddressLineMaxLength),
                new string('b', AddressValidationConstants.SiteCityMaxLength)));

        Assert.Null(exception);
    }

    [Fact]
    public void ValidateOperationalFields_RejectsOverlongAddressLine()
    {
        Assert.Throws<UserValidationException>(() =>
            SiteOperationalFieldValidation.ValidateOperationalFields(
                new string('a', AddressValidationConstants.SiteAddressLineMaxLength + 1),
                "City"));
    }

    [Fact]
    public void ValidateOperationalFields_RejectsOverlongCity()
    {
        Assert.Throws<UserValidationException>(() =>
            SiteOperationalFieldValidation.ValidateOperationalFields(
                "Line",
                new string('b', AddressValidationConstants.SiteCityMaxLength + 1)));
    }
}
