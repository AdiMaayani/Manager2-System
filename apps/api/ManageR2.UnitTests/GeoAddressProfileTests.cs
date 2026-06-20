using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo;
using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.Features.AddressProfiles;

namespace ManageR2.UnitTests;

public class AddressProfileValidationRulesTests
{
    [Fact]
    public void ValidatePersistedProfile_RejectsValidatedWithoutProviderProof()
    {
        var profile = new AddressProfile
        {
            InputAddress = "Tel Aviv",
            ValidationStatus = AddressValidationConstants.Statuses.Validated,
            ValidationProvider = AddressValidationConstants.Providers.Geoapify
        };

        Assert.Throws<UserValidationException>(() => AddressProfileValidationRules.ValidatePersistedProfile(profile));
    }

    [Fact]
    public void ValidatePersistedProfile_AllowsTypedWithoutProviderFields()
    {
        var profile = new AddressProfile
        {
            InputAddress = "Tel Aviv",
            ValidationStatus = AddressValidationConstants.Statuses.Typed
        };

        var exception = Record.Exception(() => AddressProfileValidationRules.ValidatePersistedProfile(profile));
        Assert.Null(exception);
    }

    [Fact]
    public void ApplyStaleIfTextChanged_DowngradesValidatedWhenInputChanges()
    {
        var existing = new AddressProfile
        {
            InputAddress = "Old address",
            ValidationStatus = AddressValidationConstants.Statuses.Validated,
            ValidatedAt = DateTime.UtcNow
        };

        var incoming = new AddressProfile
        {
            InputAddress = "New address",
            ValidationStatus = AddressValidationConstants.Statuses.Validated,
            ValidatedAt = DateTime.UtcNow
        };

        var result = AddressProfileValidationRules.ApplyStaleIfTextChanged(existing, incoming);

        Assert.Equal(AddressValidationConstants.Statuses.Stale, result.ValidationStatus);
        Assert.Null(result.ValidatedAt);
    }
}

public class AddressIdentityComparerTests
{
    [Fact]
    public void HasStableIdentityChanged_ReturnsFalseWhenUnchangedPlaceRef()
    {
        var previous = new AddressProfile { ExternalPlaceRef = "place-1" };
        var next = new AddressProfile { ExternalPlaceRef = "place-1" };

        Assert.False(AddressIdentityComparer.HasStableIdentityChanged(previous, next));
    }

    [Fact]
    public void HasStableIdentityChanged_ReturnsTrueWhenPlaceRefChanges()
    {
        var previous = new AddressProfile { ExternalPlaceRef = "place-1" };
        var next = new AddressProfile { ExternalPlaceRef = "place-2" };

        Assert.True(AddressIdentityComparer.HasStableIdentityChanged(previous, next));
    }
}
