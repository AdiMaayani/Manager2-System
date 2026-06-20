using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Features.AddressProfiles.Repositories;

public class SiteAddressProfileRepository : ISiteAddressProfileRepository
{
    private readonly DBServices _dbServices;

    public SiteAddressProfileRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<AddressProfile?> GetBySiteIdAsync(int siteId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_SiteAddressProfile_GetBySiteId", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@SiteId", siteId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return MapProfile(reader, siteId);
    }

    public async Task<SiteWithAddressProfileRecord> SaveSiteWithAddressProfileAsync(SiteWithAddressProfileRecord request)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_Site_SaveWithAddressProfile", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        var profile = request.Profile;
        command.Parameters.AddWithValue("@SiteId", request.SiteId.HasValue && request.SiteId.Value > 0
            ? request.SiteId.Value
            : DBNull.Value);
        command.Parameters.AddWithValue("@CustomerId", request.CustomerId);
        command.Parameters.AddWithValue("@SiteName", request.SiteName);
        command.Parameters.AddWithValue("@AddressLine", (object?)request.AddressLine ?? DBNull.Value);
        command.Parameters.AddWithValue("@City", (object?)request.City ?? DBNull.Value);
        command.Parameters.AddWithValue("@IsPrimary", request.IsPrimary);
        command.Parameters.AddWithValue("@Notes", (object?)request.Notes ?? DBNull.Value);

        if (profile is null)
        {
            command.Parameters.AddWithValue("@InputAddress", DBNull.Value);
            command.Parameters.AddWithValue("@FormattedAddress", DBNull.Value);
            command.Parameters.AddWithValue("@ValidationProvider", DBNull.Value);
            command.Parameters.AddWithValue("@ValidationStatus", DBNull.Value);
            command.Parameters.AddWithValue("@ValidationVerdict", DBNull.Value);
            command.Parameters.AddWithValue("@ValidationScore", DBNull.Value);
            command.Parameters.AddWithValue("@ExternalPlaceRef", DBNull.Value);
            command.Parameters.AddWithValue("@Street", DBNull.Value);
            command.Parameters.AddWithValue("@HouseNumber", DBNull.Value);
            command.Parameters.AddWithValue("@ProfileCity", DBNull.Value);
            command.Parameters.AddWithValue("@Postcode", DBNull.Value);
            command.Parameters.AddWithValue("@StateOrRegion", DBNull.Value);
            command.Parameters.AddWithValue("@Country", DBNull.Value);
            command.Parameters.AddWithValue("@ZoneId", DBNull.Value);
            command.Parameters.AddWithValue("@Latitude", DBNull.Value);
            command.Parameters.AddWithValue("@Longitude", DBNull.Value);
            command.Parameters.AddWithValue("@ValidatedAt", DBNull.Value);
        }
        else
        {
            command.Parameters.AddWithValue("@InputAddress", (object?)profile.InputAddress ?? DBNull.Value);
            command.Parameters.AddWithValue("@FormattedAddress", (object?)profile.FormattedAddress ?? DBNull.Value);
            command.Parameters.AddWithValue("@ValidationProvider", (object?)profile.ValidationProvider ?? DBNull.Value);
            command.Parameters.AddWithValue("@ValidationStatus", (object?)profile.ValidationStatus ?? DBNull.Value);
            command.Parameters.AddWithValue("@ValidationVerdict", (object?)profile.ValidationVerdict ?? DBNull.Value);
            command.Parameters.AddWithValue("@ValidationScore", (object?)profile.ValidationScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@ExternalPlaceRef", (object?)profile.ExternalPlaceRef ?? DBNull.Value);
            command.Parameters.AddWithValue("@Street", (object?)profile.Street ?? DBNull.Value);
            command.Parameters.AddWithValue("@HouseNumber", (object?)profile.HouseNumber ?? DBNull.Value);
            command.Parameters.AddWithValue("@ProfileCity", (object?)profile.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@Postcode", (object?)profile.Postcode ?? DBNull.Value);
            command.Parameters.AddWithValue("@StateOrRegion", (object?)profile.StateOrRegion ?? DBNull.Value);
            command.Parameters.AddWithValue("@Country", (object?)profile.Country ?? DBNull.Value);
            command.Parameters.AddWithValue("@ZoneId", (object?)profile.ZoneId ?? DBNull.Value);
            command.Parameters.AddWithValue("@Latitude", (object?)profile.Latitude ?? DBNull.Value);
            command.Parameters.AddWithValue("@Longitude", (object?)profile.Longitude ?? DBNull.Value);
            command.Parameters.AddWithValue("@ValidatedAt", (object?)profile.ValidatedAt ?? DBNull.Value);
        }

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new UserValidationException("Failed to save site with address profile.");
        }

        var siteId = reader.GetInt32(reader.GetOrdinal("SiteId"));
        var result = new SiteWithAddressProfileRecord
        {
            SiteId = siteId,
            CustomerId = reader.GetInt32(reader.GetOrdinal("CustomerId")),
            SiteName = reader.GetString(reader.GetOrdinal("SiteName")),
            AddressLine = GetNullableString(reader, "AddressLine"),
            City = GetNullableString(reader, "City"),
            IsPrimary = reader.GetBoolean(reader.GetOrdinal("IsPrimary")),
            Notes = GetNullableString(reader, "Notes"),
            Site = new SiteOperationalRecord
            {
                SiteId = siteId,
                CustomerId = reader.GetInt32(reader.GetOrdinal("CustomerId")),
                SiteName = reader.GetString(reader.GetOrdinal("SiteName")),
                AddressLine = GetNullableString(reader, "AddressLine"),
                City = GetNullableString(reader, "City"),
                IsPrimary = reader.GetBoolean(reader.GetOrdinal("IsPrimary")),
                Notes = GetNullableString(reader, "Notes"),
                CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt")),
                UpdatedAt = GetNullableDateTime(reader, "UpdatedAt")
            }
        };

        if (!reader.IsDBNull(reader.GetOrdinal("SiteAddressProfileId")))
        {
            result.Profile = new AddressProfile
            {
                ProfileId = reader.GetInt32(reader.GetOrdinal("SiteAddressProfileId")),
                OwnerId = siteId,
                InputAddress = GetNullableString(reader, "InputAddress") ?? string.Empty,
                FormattedAddress = GetNullableString(reader, "FormattedAddress"),
                ValidationProvider = GetNullableString(reader, "ValidationProvider"),
                ValidationStatus = GetNullableString(reader, "ValidationStatus"),
                ValidationVerdict = GetNullableString(reader, "ValidationVerdict"),
                ValidationScore = GetNullableDecimal(reader, "ValidationScore"),
                ExternalPlaceRef = GetNullableString(reader, "ExternalPlaceRef"),
                Street = GetNullableString(reader, "Street"),
                HouseNumber = GetNullableString(reader, "HouseNumber"),
                City = GetNullableString(reader, "ProfileCity"),
                Postcode = GetNullableString(reader, "Postcode"),
                StateOrRegion = GetNullableString(reader, "StateOrRegion"),
                Country = GetNullableString(reader, "Country"),
                ZoneId = GetNullableInt(reader, "ZoneId"),
                Latitude = GetNullableDecimal(reader, "Latitude"),
                Longitude = GetNullableDecimal(reader, "Longitude"),
                ValidatedAt = GetNullableDateTime(reader, "ValidatedAt"),
                CreatedAt = GetNullableDateTime(reader, "ProfileCreatedAt"),
                UpdatedAt = GetNullableDateTime(reader, "ProfileUpdatedAt")
            };
        }

        return result;
    }

    private static AddressProfile MapProfile(SqlDataReader reader, int siteId)
    {
        return new AddressProfile
        {
            ProfileId = reader.GetInt32(reader.GetOrdinal("SiteAddressProfileId")),
            OwnerId = siteId,
            InputAddress = GetNullableString(reader, "InputAddress") ?? string.Empty,
            FormattedAddress = GetNullableString(reader, "FormattedAddress"),
            ValidationProvider = GetNullableString(reader, "ValidationProvider"),
            ValidationStatus = GetNullableString(reader, "ValidationStatus"),
            ValidationVerdict = GetNullableString(reader, "ValidationVerdict"),
            ValidationScore = GetNullableDecimal(reader, "ValidationScore"),
            ExternalPlaceRef = GetNullableString(reader, "ExternalPlaceRef"),
            Street = GetNullableString(reader, "Street"),
            HouseNumber = GetNullableString(reader, "HouseNumber"),
            City = GetNullableString(reader, "City"),
            Postcode = GetNullableString(reader, "Postcode"),
            StateOrRegion = GetNullableString(reader, "StateOrRegion"),
            Country = GetNullableString(reader, "Country"),
            ZoneId = GetNullableInt(reader, "ZoneId"),
            Latitude = GetNullableDecimal(reader, "Latitude"),
            Longitude = GetNullableDecimal(reader, "Longitude"),
            ValidatedAt = GetNullableDateTime(reader, "ValidatedAt"),
            CreatedAt = GetNullableDateTime(reader, "CreatedAt"),
            UpdatedAt = GetNullableDateTime(reader, "UpdatedAt")
        };
    }

    private static string? GetNullableString(SqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static int? GetNullableInt(SqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
    }

    private static decimal? GetNullableDecimal(SqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDecimal(ordinal);
    }

    private static DateTime? GetNullableDateTime(SqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}
