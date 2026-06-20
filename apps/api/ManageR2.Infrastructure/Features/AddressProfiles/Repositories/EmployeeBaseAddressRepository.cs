using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Features.AddressProfiles.Repositories;

public class EmployeeBaseAddressRepository : IEmployeeBaseAddressRepository
{
    private readonly DBServices _dbServices;

    public EmployeeBaseAddressRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<AddressProfile?> GetByEmployeeIdAsync(int employeeId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_EmployeeBaseAddress_GetByEmployeeId", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@EmployeeId", employeeId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return MapProfile(reader, employeeId);
    }

    public async Task<AddressProfile> UpsertAsync(AddressProfile profile)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_EmployeeBaseAddress_Upsert", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        AddProfileParameters(command, profile);
        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new UserValidationException("Failed to save employee base address.");
        }

        return MapProfile(reader, profile.OwnerId);
    }

    public async Task InvalidateRoutesByEmployeeIdAsync(int employeeId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_RouteEstimates_InvalidateByEmployeeId", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@EmployeeId", employeeId);
        await connection.OpenAsync();
        await command.ExecuteNonQueryAsync();
    }

    private static void AddProfileParameters(SqlCommand command, AddressProfile profile)
    {
        command.Parameters.AddWithValue("@EmployeeId", profile.OwnerId);
        command.Parameters.AddWithValue("@InputAddress", profile.InputAddress);
        command.Parameters.AddWithValue("@FormattedAddress", (object?)profile.FormattedAddress ?? DBNull.Value);
        command.Parameters.AddWithValue("@ValidationProvider", (object?)profile.ValidationProvider ?? DBNull.Value);
        command.Parameters.AddWithValue("@ValidationStatus", (object?)profile.ValidationStatus ?? DBNull.Value);
        command.Parameters.AddWithValue("@ValidationVerdict", (object?)profile.ValidationVerdict ?? DBNull.Value);
        command.Parameters.AddWithValue("@ValidationScore", (object?)profile.ValidationScore ?? DBNull.Value);
        command.Parameters.AddWithValue("@ExternalPlaceRef", (object?)profile.ExternalPlaceRef ?? DBNull.Value);
        command.Parameters.AddWithValue("@Street", (object?)profile.Street ?? DBNull.Value);
        command.Parameters.AddWithValue("@HouseNumber", (object?)profile.HouseNumber ?? DBNull.Value);
        command.Parameters.AddWithValue("@City", (object?)profile.City ?? DBNull.Value);
        command.Parameters.AddWithValue("@Postcode", (object?)profile.Postcode ?? DBNull.Value);
        command.Parameters.AddWithValue("@StateOrRegion", (object?)profile.StateOrRegion ?? DBNull.Value);
        command.Parameters.AddWithValue("@Country", (object?)profile.Country ?? DBNull.Value);
        command.Parameters.AddWithValue("@ZoneId", (object?)profile.ZoneId ?? DBNull.Value);
        command.Parameters.AddWithValue("@Latitude", (object?)profile.Latitude ?? DBNull.Value);
        command.Parameters.AddWithValue("@Longitude", (object?)profile.Longitude ?? DBNull.Value);
        command.Parameters.AddWithValue("@ValidatedAt", (object?)profile.ValidatedAt ?? DBNull.Value);
    }

    private static AddressProfile MapProfile(SqlDataReader reader, int ownerId)
    {
        return new AddressProfile
        {
            ProfileId = GetNullableInt(reader, "EmployeeBaseAddressId"),
            OwnerId = ownerId,
            InputAddress = GetString(reader, "InputAddress") ?? string.Empty,
            FormattedAddress = GetString(reader, "FormattedAddress"),
            ValidationProvider = GetString(reader, "ValidationProvider"),
            ValidationStatus = GetString(reader, "ValidationStatus"),
            ValidationVerdict = GetString(reader, "ValidationVerdict"),
            ValidationScore = GetNullableDecimal(reader, "ValidationScore"),
            ExternalPlaceRef = GetString(reader, "ExternalPlaceRef"),
            Street = GetString(reader, "Street"),
            HouseNumber = GetString(reader, "HouseNumber"),
            City = GetString(reader, "City"),
            Postcode = GetString(reader, "Postcode"),
            StateOrRegion = GetString(reader, "StateOrRegion"),
            Country = GetString(reader, "Country"),
            ZoneId = GetNullableInt(reader, "ZoneId"),
            Latitude = GetNullableDecimal(reader, "Latitude"),
            Longitude = GetNullableDecimal(reader, "Longitude"),
            ValidatedAt = GetNullableDateTime(reader, "ValidatedAt"),
            CreatedAt = GetNullableDateTime(reader, "CreatedAt"),
            UpdatedAt = GetNullableDateTime(reader, "UpdatedAt")
        };
    }

    private static string? GetString(SqlDataReader reader, string columnName)
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
