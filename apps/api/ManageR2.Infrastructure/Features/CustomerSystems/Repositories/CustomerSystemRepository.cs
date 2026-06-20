using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// Customer Systems Vault persistence: ADO.NET stored procedure calls only, no inline SQL. Secret values
// are stored/returned as opaque encrypted strings; encryption/decryption is handled in the API layer.
public class CustomerSystemRepository : ICustomerSystemRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<CustomerSystemRepository> _logger;

    public CustomerSystemRepository(DBServices dbServices, ILogger<CustomerSystemRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<CustomerSystem>> GetSystemsAsync(int customerId, bool includeInactive)
    {
        _logger.LogInformation(
            "GetSystemsAsync started for CustomerId={CustomerId}, IncludeInactive={IncludeInactive}.",
            customerId,
            includeInactive);

        var systems = new List<CustomerSystem>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystems_GetList", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", customerId);
            command.Parameters.AddWithValue("@IncludeInactive", includeInactive);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                systems.Add(MapSystem(reader));
            }

            _logger.LogInformation("GetSystemsAsync succeeded for CustomerId={CustomerId}. Returned {Count} systems.", customerId, systems.Count);

            return systems;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetSystemsAsync failed with SQL error for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to retrieve customer systems.", ex);
        }
    }

    public async Task<CustomerSystem?> GetSystemByIdAsync(int customerSystemId)
    {
        _logger.LogInformation("GetSystemByIdAsync started for CustomerSystemId={CustomerSystemId}.", customerSystemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystems_GetById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerSystemId", customerSystemId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return MapSystem(reader);
            }

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetSystemByIdAsync failed with SQL error for CustomerSystemId={CustomerSystemId}.", customerSystemId);
            throw new UserValidationException("Failed to retrieve the requested customer system.", ex);
        }
    }

    public async Task<int> CreateSystemAsync(CustomerSystem system)
    {
        _logger.LogInformation(
            "CreateSystemAsync started for CustomerId={CustomerId}, SystemName={SystemName}.",
            system.CustomerId,
            system.SystemName);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystems_Create", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", system.CustomerId);
            AddSystemParameters(command, system);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newId = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            _logger.LogInformation("CreateSystemAsync succeeded. Created CustomerSystemId={CustomerSystemId}.", newId);

            return newId;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(ex, "CreateSystemAsync failed for CustomerId={CustomerId} because of a reference constraint.", system.CustomerId);
            throw new UserValidationException("The customer or site reference is invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateSystemAsync failed with SQL error for CustomerId={CustomerId}.", system.CustomerId);
            throw new UserValidationException("Failed to create the customer system.", ex);
        }
    }

    public async Task<bool> UpdateSystemAsync(CustomerSystem system)
    {
        _logger.LogInformation("UpdateSystemAsync started for CustomerSystemId={CustomerSystemId}.", system.CustomerSystemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystems_Update", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerSystemId", system.CustomerSystemId);
            AddSystemParameters(command, system);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(ex, "UpdateSystemAsync failed for CustomerSystemId={CustomerSystemId} because of a reference constraint.", system.CustomerSystemId);
            throw new UserValidationException("The customer or site reference is invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateSystemAsync failed with SQL error for CustomerSystemId={CustomerSystemId}.", system.CustomerSystemId);
            throw new UserValidationException("Failed to update the customer system.", ex);
        }
    }

    public async Task<bool> DeactivateSystemAsync(int customerSystemId)
    {
        _logger.LogInformation("DeactivateSystemAsync started for CustomerSystemId={CustomerSystemId}.", customerSystemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystems_Deactivate", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerSystemId", customerSystemId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeactivateSystemAsync failed with SQL error for CustomerSystemId={CustomerSystemId}.", customerSystemId);
            throw new UserValidationException("Failed to deactivate the customer system.", ex);
        }
    }

    public async Task<IEnumerable<CustomerSystemSecret>> GetSecretsMetadataAsync(int customerSystemId)
    {
        _logger.LogInformation("GetSecretsMetadataAsync started for CustomerSystemId={CustomerSystemId}.", customerSystemId);

        var secrets = new List<CustomerSystemSecret>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystemSecrets_GetMetadata", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerSystemId", customerSystemId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                secrets.Add(MapSecretMetadata(reader));
            }

            return secrets;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetSecretsMetadataAsync failed with SQL error for CustomerSystemId={CustomerSystemId}.", customerSystemId);
            throw new UserValidationException("Failed to retrieve secret metadata.", ex);
        }
    }

    public async Task<int> CreateSecretAsync(CustomerSystemSecret secret)
    {
        _logger.LogInformation(
            "CreateSecretAsync started for CustomerSystemId={CustomerSystemId}, SecretType={SecretType}.",
            secret.CustomerSystemId,
            secret.SecretType);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystemSecrets_Create", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerSystemId", secret.CustomerSystemId);
            command.Parameters.AddWithValue("@SecretType", secret.SecretType);
            command.Parameters.AddWithValue("@Username", (object?)secret.Username ?? DBNull.Value);
            command.Parameters.AddWithValue("@EncryptedSecretValue", secret.EncryptedSecretValue);
            command.Parameters.AddWithValue("@MaskedPreview", (object?)secret.MaskedPreview ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)secret.Notes ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", secret.IsActive);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newId = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            _logger.LogInformation("CreateSecretAsync succeeded. Created SecretId={SecretId}.", newId);

            return newId;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(ex, "CreateSecretAsync failed for CustomerSystemId={CustomerSystemId} because of a reference constraint.", secret.CustomerSystemId);
            throw new UserValidationException("The customer system reference is invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateSecretAsync failed with SQL error for CustomerSystemId={CustomerSystemId}.", secret.CustomerSystemId);
            throw new UserValidationException("Failed to create the secret.", ex);
        }
    }

    public async Task<bool> UpdateSecretAsync(CustomerSystemSecret secret, bool replaceSecretValue)
    {
        _logger.LogInformation(
            "UpdateSecretAsync started for SecretId={SecretId}, ReplaceSecretValue={ReplaceSecretValue}.",
            secret.SecretId,
            replaceSecretValue);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystemSecrets_Update", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@SecretId", secret.SecretId);
            command.Parameters.AddWithValue("@SecretType", secret.SecretType);
            command.Parameters.AddWithValue("@Username", (object?)secret.Username ?? DBNull.Value);
            // When not replacing, send NULL so the stored procedure preserves the existing encrypted value.
            command.Parameters.AddWithValue(
                "@EncryptedSecretValue",
                replaceSecretValue ? secret.EncryptedSecretValue : (object)DBNull.Value);
            command.Parameters.AddWithValue(
                "@MaskedPreview",
                replaceSecretValue ? (object?)secret.MaskedPreview ?? DBNull.Value : DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)secret.Notes ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", secret.IsActive);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateSecretAsync failed with SQL error for SecretId={SecretId}.", secret.SecretId);
            throw new UserValidationException("Failed to update the secret.", ex);
        }
    }

    public async Task<bool> DeactivateSecretAsync(int secretId)
    {
        _logger.LogInformation("DeactivateSecretAsync started for SecretId={SecretId}.", secretId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystemSecrets_Deactivate", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@SecretId", secretId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeactivateSecretAsync failed with SQL error for SecretId={SecretId}.", secretId);
            throw new UserValidationException("Failed to deactivate the secret.", ex);
        }
    }

    public async Task<CustomerSystemSecret?> GetSecretForRevealAsync(int customerSystemId, int secretId)
    {
        _logger.LogInformation(
            "GetSecretForRevealAsync started for CustomerSystemId={CustomerSystemId}, SecretId={SecretId}.",
            customerSystemId,
            secretId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystemSecrets_GetForReveal", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerSystemId", customerSystemId);
            command.Parameters.AddWithValue("@SecretId", secretId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return new CustomerSystemSecret
                {
                    SecretId = GetIntValue(reader, "SecretId"),
                    CustomerSystemId = GetIntValue(reader, "CustomerSystemId"),
                    SecretType = GetStringValue(reader, "SecretType") ?? string.Empty,
                    Username = GetStringValue(reader, "Username"),
                    EncryptedSecretValue = GetStringValue(reader, "EncryptedSecretValue") ?? string.Empty,
                    IsActive = GetBoolValue(reader, "IsActive")
                };
            }

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetSecretForRevealAsync failed with SQL error for SecretId={SecretId}.", secretId);
            throw new UserValidationException("Failed to read the secret for reveal.", ex);
        }
    }

    public async Task LogSecretAccessAsync(
        int secretId,
        int customerSystemId,
        int accessedByUserId,
        string? accessReason,
        string action,
        string? clientIp)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CustomerSystemSecrets_LogAccess", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@SecretId", secretId);
            command.Parameters.AddWithValue("@CustomerSystemId", customerSystemId);
            command.Parameters.AddWithValue("@AccessedByUserId", accessedByUserId);
            command.Parameters.AddWithValue("@AccessReason", (object?)accessReason ?? DBNull.Value);
            command.Parameters.AddWithValue("@Action", string.IsNullOrWhiteSpace(action) ? "RevealSecret" : action);
            command.Parameters.AddWithValue("@ClientIp", (object?)clientIp ?? DBNull.Value);

            await connection.OpenAsync();
            await command.ExecuteScalarAsync();
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "LogSecretAccessAsync failed with SQL error for SecretId={SecretId}.", secretId);
            throw new UserValidationException("Failed to record secret access.", ex);
        }
    }

    private static void AddSystemParameters(SqlCommand command, CustomerSystem system)
    {
        command.Parameters.AddWithValue("@SiteId", (object?)system.SiteId ?? DBNull.Value);
        command.Parameters.AddWithValue("@SystemType", system.SystemType);
        command.Parameters.AddWithValue("@SystemName", system.SystemName);
        command.Parameters.AddWithValue("@Vendor", (object?)system.Vendor ?? DBNull.Value);
        command.Parameters.AddWithValue("@Model", (object?)system.Model ?? DBNull.Value);
        command.Parameters.AddWithValue("@Host", (object?)system.Host ?? DBNull.Value);
        command.Parameters.AddWithValue("@Port", (object?)system.Port ?? DBNull.Value);
        command.Parameters.AddWithValue("@Url", (object?)system.Url ?? DBNull.Value);
        command.Parameters.AddWithValue("@LocationDescription", (object?)system.LocationDescription ?? DBNull.Value);
        command.Parameters.AddWithValue("@Notes", (object?)system.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("@IsActive", system.IsActive);
    }

    private static CustomerSystem MapSystem(SqlDataReader reader)
    {
        return new CustomerSystem
        {
            CustomerSystemId = GetIntValue(reader, "CustomerSystemId"),
            CustomerId = GetIntValue(reader, "CustomerId"),
            SiteId = GetNullableIntValue(reader, "SiteId"),
            SiteName = GetStringValue(reader, "SiteName"),
            SystemType = GetStringValue(reader, "SystemType") ?? string.Empty,
            SystemName = GetStringValue(reader, "SystemName") ?? string.Empty,
            Vendor = GetStringValue(reader, "Vendor"),
            Model = GetStringValue(reader, "Model"),
            Host = GetStringValue(reader, "Host"),
            Port = GetNullableIntValue(reader, "Port"),
            Url = GetStringValue(reader, "Url"),
            LocationDescription = GetStringValue(reader, "LocationDescription"),
            Notes = GetStringValue(reader, "Notes"),
            IsActive = GetBoolValue(reader, "IsActive"),
            CreatedAtUtc = GetDateTimeValue(reader, "CreatedAtUtc") ?? DateTime.MinValue,
            UpdatedAtUtc = GetDateTimeValue(reader, "UpdatedAtUtc")
        };
    }

    private static CustomerSystemSecret MapSecretMetadata(SqlDataReader reader)
    {
        return new CustomerSystemSecret
        {
            SecretId = GetIntValue(reader, "SecretId"),
            CustomerSystemId = GetIntValue(reader, "CustomerSystemId"),
            SecretType = GetStringValue(reader, "SecretType") ?? string.Empty,
            Username = GetStringValue(reader, "Username"),
            MaskedPreview = GetStringValue(reader, "MaskedPreview"),
            Notes = GetStringValue(reader, "Notes"),
            IsActive = GetBoolValue(reader, "IsActive"),
            CreatedAtUtc = GetDateTimeValue(reader, "CreatedAtUtc") ?? DateTime.MinValue,
            UpdatedAtUtc = GetDateTimeValue(reader, "UpdatedAtUtc")
            // EncryptedSecretValue intentionally not read on the metadata path.
        };
    }

    private static bool HasColumn(SqlDataReader reader, string columnName)
    {
        for (int i = 0; i < reader.FieldCount; i++)
        {
            if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static string? GetStringValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return reader[columnName]?.ToString();
    }

    private static int GetIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return 0;
        }

        return Convert.ToInt32(reader[columnName]);
    }

    private static int? GetNullableIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToInt32(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return false;
        }

        return Convert.ToBoolean(reader[columnName]);
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDateTime(reader[columnName]);
    }
}
