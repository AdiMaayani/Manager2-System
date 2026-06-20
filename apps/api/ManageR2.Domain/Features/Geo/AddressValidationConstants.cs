namespace ManageR2.Domain.Features.Geo;

public static class AddressValidationConstants
{
    public static class Providers
    {
        public const string Geoapify = "Geoapify";
    }

    public static class Statuses
    {
        public const string Typed = "Typed";
        public const string Validated = "Validated";
        public const string Invalid = "Invalid";
        public const string Stale = "Stale";
    }

    public static class Verdicts
    {
        public const string Valid = "Valid";
        public const string Incomplete = "Incomplete";
        public const string NotFound = "NotFound";
    }

    public const int MinAutocompleteLength = 3;
    public const int MinValidatedScore = 70;

    public const int SiteAddressLineMaxLength = 200;
    public const int SiteCityMaxLength = 50;
    public const int ProfileInputAddressMaxLength = 300;
    public const int ProfileFormattedAddressMaxLength = 300;
    public const int ProfileCityMaxLength = 100;

    public static readonly HashSet<string> PersistedStatuses = new(StringComparer.Ordinal)
    {
        Statuses.Typed,
        Statuses.Validated,
        Statuses.Invalid,
        Statuses.Stale
    };
}
