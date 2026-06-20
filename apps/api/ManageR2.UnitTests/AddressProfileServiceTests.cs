using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo;
using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;
using ManageR2.Infrastructure.Features.AddressProfiles.Services;
using Moq;

namespace ManageR2.UnitTests;

public class AddressProfileServiceTests
{
    [Fact]
    public async Task UpsertEmployeeBaseAddressAsync_InvalidatesRoutes_WhenValidatedIdentityChanges()
    {
        var employeeId = 42;
        var existing = CreateValidatedProfile("Old address", "place-old");
        var incoming = CreateValidatedProfile("New address", "place-new");
        var saved = CreateValidatedProfile("New address", "place-new");

        var employeeRepository = new Mock<IEmployeeBaseAddressRepository>();
        employeeRepository
            .Setup(repository => repository.GetByEmployeeIdAsync(employeeId))
            .ReturnsAsync(existing);
        employeeRepository
            .Setup(repository => repository.UpsertAsync(It.IsAny<AddressProfile>()))
            .ReturnsAsync(saved);

        var siteRepository = new Mock<ISiteAddressProfileRepository>();
        var service = new AddressProfileService(employeeRepository.Object, siteRepository.Object);

        await service.UpsertEmployeeBaseAddressAsync(employeeId, incoming);

        employeeRepository.Verify(repository => repository.InvalidateRoutesByEmployeeIdAsync(employeeId), Times.Once);
    }

    [Fact]
    public async Task UpsertEmployeeBaseAddressAsync_DoesNotInvalidateRoutes_WhenValidatedIdentityUnchanged()
    {
        var employeeId = 42;
        var existing = CreateValidatedProfile("Same address", "place-1");
        var incoming = CreateValidatedProfile("Same address", "place-1");
        var saved = CreateValidatedProfile("Same address", "place-1");

        var employeeRepository = new Mock<IEmployeeBaseAddressRepository>();
        employeeRepository
            .Setup(repository => repository.GetByEmployeeIdAsync(employeeId))
            .ReturnsAsync(existing);
        employeeRepository
            .Setup(repository => repository.UpsertAsync(It.IsAny<AddressProfile>()))
            .ReturnsAsync(saved);

        var siteRepository = new Mock<ISiteAddressProfileRepository>();
        var service = new AddressProfileService(employeeRepository.Object, siteRepository.Object);

        await service.UpsertEmployeeBaseAddressAsync(employeeId, incoming);

        employeeRepository.Verify(repository => repository.InvalidateRoutesByEmployeeIdAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task UpsertEmployeeBaseAddressAsync_AllowsFirstProfile_WhenNoExistingProfile()
    {
        var employeeId = 7;
        var incoming = new AddressProfile
        {
            InputAddress = "Typed only",
            ValidationStatus = AddressValidationConstants.Statuses.Typed
        };
        var saved = new AddressProfile
        {
            InputAddress = incoming.InputAddress,
            ValidationStatus = incoming.ValidationStatus,
            OwnerId = employeeId
        };

        var employeeRepository = new Mock<IEmployeeBaseAddressRepository>();
        employeeRepository
            .Setup(repository => repository.GetByEmployeeIdAsync(employeeId))
            .ReturnsAsync((AddressProfile?)null);
        employeeRepository
            .Setup(repository => repository.UpsertAsync(It.IsAny<AddressProfile>()))
            .ReturnsAsync(saved);

        var siteRepository = new Mock<ISiteAddressProfileRepository>();
        var service = new AddressProfileService(employeeRepository.Object, siteRepository.Object);

        var result = await service.UpsertEmployeeBaseAddressAsync(employeeId, incoming);

        Assert.Equal(AddressValidationConstants.Statuses.Typed, result.ValidationStatus);
        employeeRepository.Verify(repository => repository.InvalidateRoutesByEmployeeIdAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task UpsertEmployeeBaseAddressAsync_RejectsValidatedWithoutProof()
    {
        var employeeId = 9;
        var incoming = new AddressProfile
        {
            InputAddress = "Tel Aviv",
            ValidationStatus = AddressValidationConstants.Statuses.Validated,
            ValidationProvider = AddressValidationConstants.Providers.Geoapify
        };

        var employeeRepository = new Mock<IEmployeeBaseAddressRepository>();
        employeeRepository
            .Setup(repository => repository.GetByEmployeeIdAsync(employeeId))
            .ReturnsAsync((AddressProfile?)null);

        var siteRepository = new Mock<ISiteAddressProfileRepository>();
        var service = new AddressProfileService(employeeRepository.Object, siteRepository.Object);

        await Assert.ThrowsAsync<UserValidationException>(() =>
            service.UpsertEmployeeBaseAddressAsync(employeeId, incoming));
    }

    [Fact]
    public async Task SaveSiteWithAddressProfileAsync_SyncsOperationalAddressFields_FromValidatedProfile()
    {
        var profile = CreateValidatedProfile("Herzl 1, Tel Aviv", "place-1");
        profile.Street = "Herzl";
        profile.HouseNumber = "1";
        profile.City = "Tel Aviv";

        var request = new SiteWithAddressProfileRecord
        {
            SiteId = 5,
            CustomerId = 1,
            SiteName = "Main site",
            IsPrimary = true,
            Profile = profile
        };

        var siteRepository = new Mock<ISiteAddressProfileRepository>();
        siteRepository
            .Setup(repository => repository.GetBySiteIdAsync(5))
            .ReturnsAsync((AddressProfile?)null);
        siteRepository
            .Setup(repository => repository.SaveSiteWithAddressProfileAsync(It.IsAny<SiteWithAddressProfileRecord>()))
            .ReturnsAsync((SiteWithAddressProfileRecord saved) => saved);

        var employeeRepository = new Mock<IEmployeeBaseAddressRepository>();
        var service = new AddressProfileService(employeeRepository.Object, siteRepository.Object);

        var result = await service.SaveSiteWithAddressProfileAsync(request);

        Assert.Equal("Herzl 1", result.AddressLine);
        Assert.Equal("Tel Aviv", result.City);
        siteRepository.Verify(repository => repository.SaveSiteWithAddressProfileAsync(It.IsAny<SiteWithAddressProfileRecord>()), Times.Once);
    }

    [Fact]
    public async Task SaveSiteWithAddressProfileAsync_AllowsNullProfile_ForBackwardCompatibility()
    {
        var request = new SiteWithAddressProfileRecord
        {
            SiteId = 3,
            CustomerId = 1,
            SiteName = "Legacy site",
            AddressLine = "Legacy line",
            City = "Legacy city",
            IsPrimary = false,
            Profile = null
        };

        var siteRepository = new Mock<ISiteAddressProfileRepository>();
        siteRepository
            .Setup(repository => repository.SaveSiteWithAddressProfileAsync(request))
            .ReturnsAsync(request);

        var employeeRepository = new Mock<IEmployeeBaseAddressRepository>();
        var service = new AddressProfileService(employeeRepository.Object, siteRepository.Object);

        var result = await service.SaveSiteWithAddressProfileAsync(request);

        Assert.Equal("Legacy line", result.AddressLine);
        Assert.Equal("Legacy city", result.City);
        Assert.Null(result.Profile);
    }

    private static AddressProfile CreateValidatedProfile(string inputAddress, string placeRef)
    {
        return new AddressProfile
        {
            InputAddress = inputAddress,
            FormattedAddress = inputAddress,
            ValidationProvider = AddressValidationConstants.Providers.Geoapify,
            ValidationStatus = AddressValidationConstants.Statuses.Validated,
            ValidationVerdict = AddressValidationConstants.Verdicts.Valid,
            ValidationScore = AddressValidationConstants.MinValidatedScore,
            ExternalPlaceRef = placeRef,
            Latitude = 32.08m,
            Longitude = 34.78m,
            ValidatedAt = DateTime.UtcNow
        };
    }
}
