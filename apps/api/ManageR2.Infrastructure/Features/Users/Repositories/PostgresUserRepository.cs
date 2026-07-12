using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace ManageR2.Infrastructure.Features.Users.Repositories;

// PostgreSQL implementation of the user/identity contract (migration target). Reproduces the SQL Server
// user stored procedures as parameterized SQL / transactional C# against the translated identity tables.
// Fidelity notes:
//   - sp_DeleteUser is a transactional SOFT delete (deactivate user + cascade roles/departments), not a
//     hard delete; returns false when the user was not active.
//   - SetUserRoles/SetUserDepartments deactivate all then re-activate/insert the provided names.
//   - sp_RestoreUser reactivates the user and synchronizes roles/departments to EXACTLY the selected set
//     in one transaction; at least one role is required.
//   - Unique violations (23505) -> "email already exists"; FK violations (23503) -> "EmployeeId does not exist",
//     matching the SQL Server 2627/2601/547 mapping.
//   - Login-lockout methods are best-effort: the FailedLoginAttempts/LockoutUntilUtc columns are a pending
//     migration and may not exist, so errors are swallowed (treat as not-locked / no-op), exactly like the
//     SQL Server implementation guards a not-yet-applied migration.
public sealed class PostgresUserRepository : IUserRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresUserRepository> _logger;

    public PostgresUserRepository(
        PostgresConnectionFactory connectionFactory,
        ILogger<PostgresUserRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    private const string UserColumns =
        """
        "UserId", "EmployeeId", "Username", "Email", "PasswordHash", "PasswordSalt",
        "IsActive", "LastLoginAt", "CreatedAt", "Phone", "Notes"
        """;

    public async Task<IEnumerable<User>> GetUsersAsync()
    {
        var users = new List<User>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {UserColumns}
                FROM "Users"
                ORDER BY "UserId" DESC
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                users.Add(MapUser(reader));
            }

            return users;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetUsersAsync failed.");
            throw new UserValidationException("Failed to retrieve users from the database.", ex);
        }
    }

    public async Task<User?> GetUserByIdAsync(int userId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {UserColumns}
                FROM "Users"
                WHERE "UserId" = @UserId
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapUser(reader) : null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetUserByIdAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to retrieve the requested user from the database.", ex);
        }
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {UserColumns}
                FROM "Users"
                WHERE "Email" = @Email
                """;
            AddParameter(command, "@Email", email);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapUser(reader) : null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetUserByEmailAsync failed for Email={Email}.", email);
            throw new UserValidationException("Failed to retrieve user by email.", ex);
        }
    }

    public async Task<int> CreateUserAsync(User user)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "Users"
                    ("EmployeeId", "Username", "Email", "PasswordHash", "PasswordSalt", "IsActive",
                     "CreatedAt", "Phone", "Notes")
                VALUES
                    (@EmployeeId::int, @Username::text, @Email::text, @PasswordHash::text, @PasswordSalt::text,
                     @IsActive::boolean, (now() at time zone 'utc'), @Phone::text, @Notes::text)
                RETURNING "UserId"
                """;

            AddParameter(command, "@EmployeeId", user.EmployeeId);
            AddParameter(command, "@Username", user.Username);
            AddParameter(command, "@Email", user.Email);
            AddParameter(command, "@PasswordHash", user.PasswordHash);
            AddParameter(command, "@PasswordSalt", user.PasswordSalt);
            AddParameter(command, "@IsActive", user.IsActive);
            AddParameter(command, "@Phone", (object?)user.Phone ?? DBNull.Value);
            AddParameter(command, "@Notes", (object?)user.Notes ?? DBNull.Value);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            return result is null or DBNull ? 0 : Convert.ToInt32(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            _logger.LogWarning(ex, "Postgres CreateUserAsync failed because Email={Email} already exists.", user.Email);
            throw new UserValidationException("A user with this email already exists.", ex);
        }
        catch (PostgresException ex) when (ex.SqlState == "23503")
        {
            _logger.LogWarning(ex, "Postgres CreateUserAsync failed because EmployeeId={EmployeeId} does not exist.", user.EmployeeId);
            throw new UserValidationException("The specified EmployeeId does not exist.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres CreateUserAsync failed for Email={Email}.", user.Email);
            throw new UserValidationException("Failed to create the user.", ex);
        }
    }

    public async Task<bool> UpdateUserAsync(User user)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Users" SET
                    "EmployeeId"   = @EmployeeId::int,
                    "Username"     = @Username::text,
                    "Email"        = @Email::text,
                    "PasswordHash" = @PasswordHash::text,
                    "PasswordSalt" = @PasswordSalt::text,
                    "IsActive"     = @IsActive::boolean,
                    "Phone"        = @Phone::text,
                    "Notes"        = @Notes::text
                WHERE "UserId" = @UserId::int
                """;

            AddParameter(command, "@UserId", user.UserId);
            AddParameter(command, "@EmployeeId", user.EmployeeId);
            AddParameter(command, "@Username", user.Username);
            AddParameter(command, "@Email", user.Email);
            AddParameter(command, "@PasswordHash", user.PasswordHash);
            AddParameter(command, "@PasswordSalt", user.PasswordSalt);
            AddParameter(command, "@IsActive", user.IsActive);
            AddParameter(command, "@Phone", (object?)user.Phone ?? DBNull.Value);
            AddParameter(command, "@Notes", (object?)user.Notes ?? DBNull.Value);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            _logger.LogWarning(ex, "Postgres UpdateUserAsync failed because Email={Email} already exists.", user.Email);
            throw new UserValidationException("A user with this email already exists.", ex);
        }
        catch (PostgresException ex) when (ex.SqlState == "23503")
        {
            _logger.LogWarning(ex, "Postgres UpdateUserAsync failed because EmployeeId={EmployeeId} does not exist.", user.EmployeeId);
            throw new UserValidationException("The specified EmployeeId does not exist.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres UpdateUserAsync failed for UserId={UserId}.", user.UserId);
            throw new UserValidationException("Failed to update the user.", ex);
        }
    }

    // Transactional soft delete: deactivate the user, then cascade-deactivate roles/departments.
    // Returns false when the user was not active (nothing to delete).
    public async Task<bool> DeleteUserAsync(int userId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            int deactivatedUsers;
            await using (var deactivateUser = connection.CreateCommand())
            {
                deactivateUser.Transaction = transaction;
                deactivateUser.CommandText =
                    """
                    UPDATE "Users" SET "IsActive" = false
                    WHERE "UserId" = @UserId::int AND "IsActive" = true
                    """;
                AddParameter(deactivateUser, "@UserId", userId);
                deactivatedUsers = await deactivateUser.ExecuteNonQueryAsync();
            }

            if (deactivatedUsers == 0)
            {
                await transaction.RollbackAsync();
                return false;
            }

            await using (var deactivateRoles = connection.CreateCommand())
            {
                deactivateRoles.Transaction = transaction;
                deactivateRoles.CommandText =
                    """
                    UPDATE "UserRoles" SET "IsActive" = false, "RemovedAt" = (now() at time zone 'utc')
                    WHERE "UserId" = @UserId::int AND "IsActive" = true
                    """;
                AddParameter(deactivateRoles, "@UserId", userId);
                await deactivateRoles.ExecuteNonQueryAsync();
            }

            await using (var deactivateDepartments = connection.CreateCommand())
            {
                deactivateDepartments.Transaction = transaction;
                deactivateDepartments.CommandText =
                    """
                    UPDATE "UserDepartments" SET "IsActive" = false, "RemovedAt" = (now() at time zone 'utc')
                    WHERE "UserId" = @UserId::int AND "IsActive" = true
                    """;
                AddParameter(deactivateDepartments, "@UserId", userId);
                await deactivateDepartments.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
            return true;
        }
        catch (PostgresException ex) when (ex.SqlState == "23503")
        {
            _logger.LogWarning(ex, "Postgres DeleteUserAsync failed because UserId={UserId} is referenced by other records.", userId);
            throw new UserValidationException("The user cannot be deleted because it is referenced by other records.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres DeleteUserAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to delete the user.", ex);
        }
    }

    public async Task<List<string>> GetUserRolesAsync(int userId)
    {
        var roles = new List<string>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT r."RoleName"
                FROM "UserRoles" ur
                INNER JOIN "Roles" r ON ur."RoleId" = r."RoleId"
                WHERE ur."UserId" = @UserId::int AND ur."IsActive" = true
                ORDER BY r."RoleName"
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                roles.Add(reader.IsDBNull(0) ? string.Empty : reader.GetString(0));
            }

            return roles;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetUserRolesAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to retrieve user roles.", ex);
        }
    }

    public async Task<List<string>> GetUserDepartmentsAsync(int userId)
    {
        var departments = new List<string>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT d."DepartmentName"
                FROM "UserDepartments" ud
                INNER JOIN "Departments" d ON ud."DepartmentId" = d."DepartmentId"
                WHERE ud."UserId" = @UserId::int AND ud."IsActive" = true
                ORDER BY d."DepartmentName"
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                departments.Add(reader.IsDBNull(0) ? string.Empty : reader.GetString(0));
            }

            return departments;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetUserDepartmentsAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to retrieve user departments.", ex);
        }
    }

    public async Task UpdateLastLoginAtAsync(int userId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Users" SET "LastLoginAt" = (now() at time zone 'utc')
                WHERE "UserId" = @UserId::int
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres UpdateLastLoginAtAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to update last login date for the user.", ex);
        }
    }

    // Deactivate all active role links, then (re)activate/insert exactly the provided role names.
    // Wrapped in a transaction for atomicity; a role name that does not exist fails the whole operation
    // (matching sp_UpsertUserRole's RAISERROR path).
    public async Task SetUserRolesAsync(int userId, List<string> roles)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            await DeactivateAllAsync(connection, transaction, "UserRoles", userId);

            foreach (var roleName in NormalizeNames(roles))
            {
                await UpsertLinkByNameAsync(
                    connection, transaction, userId, roleName,
                    lookupTable: "Roles", nameColumn: "RoleName", idColumn: "RoleId",
                    linkTable: "UserRoles", conflictColumns: "\"UserId\", \"RoleId\"");
            }

            await transaction.CommitAsync();
        }
        catch (UserValidationException)
        {
            throw;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres SetUserRolesAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to update user roles.", ex);
        }
    }

    public async Task SetUserDepartmentsAsync(int userId, List<string> departments)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            await DeactivateAllAsync(connection, transaction, "UserDepartments", userId);

            foreach (var departmentName in NormalizeNames(departments))
            {
                await UpsertLinkByNameAsync(
                    connection, transaction, userId, departmentName,
                    lookupTable: "Departments", nameColumn: "DepartmentName", idColumn: "DepartmentId",
                    linkTable: "UserDepartments", conflictColumns: "\"UserId\", \"DepartmentId\"");
            }

            await transaction.CommitAsync();
        }
        catch (UserValidationException)
        {
            throw;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres SetUserDepartmentsAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to update user departments.", ex);
        }
    }

    // Single-transaction restore: reactivate the user and synchronize roles/departments to EXACTLY the
    // selected sets. At least one role is required.
    public async Task<bool> RestoreUserAsync(int userId, List<string> roles, List<string> departments)
    {
        var roleNames = NormalizeNames(roles).ToArray();
        var departmentNames = NormalizeNames(departments).ToArray();

        if (roleNames.Length == 0)
        {
            // Mirrors the RAISERROR path in sp_RestoreUser, which the repository surfaces as a failure.
            _logger.LogWarning("Postgres RestoreUserAsync rejected for UserId={UserId}: at least one role is required.", userId);
            throw new UserValidationException("Failed to restore the user.");
        }

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            if (!await UserExistsAsync(connection, userId))
            {
                return false;
            }

            await using var transaction = await connection.BeginTransactionAsync();

            await ExecuteAsync(connection, transaction,
                """
                UPDATE "Users" SET "IsActive" = true WHERE "UserId" = @UserId::int
                """,
                ("@UserId", userId));

            await SynchronizeLinksAsync(
                connection, transaction, userId, roleNames,
                lookupTable: "Roles", nameColumn: "RoleName", idColumn: "RoleId", linkTable: "UserRoles");

            await SynchronizeLinksAsync(
                connection, transaction, userId, departmentNames,
                lookupTable: "Departments", nameColumn: "DepartmentName", idColumn: "DepartmentId", linkTable: "UserDepartments");

            await transaction.CommitAsync();
            return true;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres RestoreUserAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to restore the user.", ex);
        }
    }

    public async Task<List<string>> GetAllRoleNamesAsync()
    {
        var roles = new List<string>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "RoleName" FROM "Roles" WHERE "IsActive" = true ORDER BY "RoleName"
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                roles.Add(reader.IsDBNull(0) ? string.Empty : reader.GetString(0));
            }

            return roles;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetAllRoleNamesAsync failed.");
            throw new UserValidationException("Failed to retrieve roles list.", ex);
        }
    }

    public async Task<List<string>> GetAllDepartmentNamesAsync()
    {
        var departments = new List<string>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "DepartmentName" FROM "Departments" ORDER BY "DepartmentName"
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                departments.Add(reader.IsDBNull(0) ? string.Empty : reader.GetString(0));
            }

            return departments;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetAllDepartmentNamesAsync failed.");
            throw new UserValidationException("Failed to retrieve departments list.", ex);
        }
    }

    // Best-effort: the FailedLoginAttempts/LockoutUntilUtc columns are a pending migration. If they are
    // absent (or any error occurs) the account is treated as not locked so login is never blocked.
    public async Task<DateTime?> GetLockoutEndUtcAsync(int userId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "LockoutUntilUtc" FROM "Users" WHERE "UserId" = @UserId::int
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            return result is null or DBNull ? null : Convert.ToDateTime(result);
        }
        catch (DbException ex)
        {
            _logger.LogWarning(ex, "Postgres GetLockoutEndUtcAsync failed for UserId={UserId}; treating account as not locked.", userId);
            return null;
        }
    }

    public async Task RegisterFailedLoginAsync(int userId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Users" SET
                    "FailedLoginAttempts" = COALESCE("FailedLoginAttempts", 0) + 1,
                    "LockoutUntilUtc" = CASE
                        WHEN COALESCE("FailedLoginAttempts", 0) + 1 >= 5
                            THEN (now() at time zone 'utc') + interval '15 minutes'
                        ELSE "LockoutUntilUtc"
                    END
                WHERE "UserId" = @UserId::int
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (DbException ex)
        {
            _logger.LogWarning(ex, "Postgres RegisterFailedLoginAsync failed for UserId={UserId}.", userId);
        }
    }

    public async Task ClearFailedLoginAsync(int userId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Users" SET
                    "FailedLoginAttempts" = 0,
                    "LockoutUntilUtc" = NULL
                WHERE "UserId" = @UserId::int
                  AND ("FailedLoginAttempts" <> 0 OR "LockoutUntilUtc" IS NOT NULL)
                """;
            AddParameter(command, "@UserId", userId);

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (DbException ex)
        {
            _logger.LogWarning(ex, "Postgres ClearFailedLoginAsync failed for UserId={UserId}.", userId);
        }
    }

    // ----- helpers -----

    private static IEnumerable<string> NormalizeNames(IEnumerable<string>? names)
    {
        if (names is null)
        {
            yield break;
        }

        foreach (var name in names)
        {
            if (!string.IsNullOrWhiteSpace(name))
            {
                yield return name.Trim();
            }
        }
    }

    private static async Task<bool> UserExistsAsync(DbConnection connection, int userId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """SELECT 1 FROM "Users" WHERE "UserId" = @UserId::int""";
        AddParameter(command, "@UserId", userId);
        var result = await command.ExecuteScalarAsync();
        return result is not null && result != DBNull.Value;
    }

    private static async Task DeactivateAllAsync(DbConnection connection, DbTransaction transaction, string linkTable, int userId)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = $"""
            UPDATE "{linkTable}" SET "IsActive" = false, "RemovedAt" = (now() at time zone 'utc')
            WHERE "UserId" = @UserId::int AND "IsActive" = true
            """;
        AddParameter(command, "@UserId", userId);
        await command.ExecuteNonQueryAsync();
    }

    // Resolves the lookup id by name (throwing if not found, matching sp_Upsert* RAISERROR), then inserts
    // the link or reactivates it on conflict.
    private async Task UpsertLinkByNameAsync(
        DbConnection connection,
        DbTransaction transaction,
        int userId,
        string name,
        string lookupTable,
        string nameColumn,
        string idColumn,
        string linkTable,
        string conflictColumns)
    {
        int lookupId;
        await using (var lookup = connection.CreateCommand())
        {
            lookup.Transaction = transaction;
            lookup.CommandText = $"""SELECT "{idColumn}" FROM "{lookupTable}" WHERE "{nameColumn}" = @Name::text""";
            AddParameter(lookup, "@Name", name);
            var result = await lookup.ExecuteScalarAsync();
            if (result is null or DBNull)
            {
                throw new UserValidationException($"{nameColumn} was not found.");
            }

            lookupId = Convert.ToInt32(result);
        }

        await using var upsert = connection.CreateCommand();
        upsert.Transaction = transaction;
        upsert.CommandText = $"""
            INSERT INTO "{linkTable}" ("UserId", "{idColumn}", "AssignedAt", "IsActive", "RemovedAt")
            VALUES (@UserId::int, @LookupId::int, (now() at time zone 'utc'), true, NULL)
            ON CONFLICT ({conflictColumns})
            DO UPDATE SET "IsActive" = true, "RemovedAt" = NULL
            """;
        AddParameter(upsert, "@UserId", userId);
        AddParameter(upsert, "@LookupId", lookupId);
        await upsert.ExecuteNonQueryAsync();
    }

    // Synchronizes a user's link table to exactly the selected names: deactivate non-selected active links,
    // reactivate selected existing links, insert selected missing links.
    private static async Task SynchronizeLinksAsync(
        DbConnection connection,
        DbTransaction transaction,
        int userId,
        string[] names,
        string lookupTable,
        string nameColumn,
        string idColumn,
        string linkTable)
    {
        // Deactivate active links whose lookup name is not in the selected set.
        await ExecuteAsync(connection, transaction, $"""
            UPDATE "{linkTable}" link
            SET "IsActive" = false, "RemovedAt" = (now() at time zone 'utc')
            WHERE link."UserId" = @UserId::int
              AND link."IsActive" = true
              AND NOT EXISTS (
                  SELECT 1 FROM "{lookupTable}" lk
                  WHERE lk."{idColumn}" = link."{idColumn}" AND lk."{nameColumn}" = ANY(@Names)
              )
            """, ("@UserId", userId), ("@Names", names));

        // Reactivate links whose lookup name is in the selected set.
        await ExecuteAsync(connection, transaction, $"""
            UPDATE "{linkTable}" link
            SET "IsActive" = true, "RemovedAt" = NULL
            FROM "{lookupTable}" lk
            WHERE lk."{idColumn}" = link."{idColumn}"
              AND link."UserId" = @UserId::int
              AND lk."{nameColumn}" = ANY(@Names)
            """, ("@UserId", userId), ("@Names", names));

        // Insert selected links that do not exist yet.
        await ExecuteAsync(connection, transaction, $"""
            INSERT INTO "{linkTable}" ("UserId", "{idColumn}", "AssignedAt", "IsActive", "RemovedAt")
            SELECT @UserId::int, lk."{idColumn}", (now() at time zone 'utc'), true, NULL
            FROM "{lookupTable}" lk
            WHERE lk."{nameColumn}" = ANY(@Names)
              AND NOT EXISTS (
                  SELECT 1 FROM "{linkTable}" link
                  WHERE link."UserId" = @UserId::int AND link."{idColumn}" = lk."{idColumn}"
              )
            """, ("@UserId", userId), ("@Names", names));
    }

    private static async Task ExecuteAsync(
        DbConnection connection,
        DbTransaction transaction,
        string commandText,
        params (string Name, object Value)[] parameters)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = commandText;
        foreach (var (name, value) in parameters)
        {
            AddParameter(command, name, value);
        }

        await command.ExecuteNonQueryAsync();
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static User MapUser(DbDataReader reader)
    {
        return new User
        {
            UserId = GetInt(reader, "UserId"),
            EmployeeId = GetInt(reader, "EmployeeId"),
            Username = GetString(reader, "Username") ?? string.Empty,
            Email = GetString(reader, "Email") ?? string.Empty,
            PasswordHash = GetString(reader, "PasswordHash") ?? string.Empty,
            PasswordSalt = GetString(reader, "PasswordSalt") ?? string.Empty,
            IsActive = GetBool(reader, "IsActive"),
            LastLoginAt = GetDateTime(reader, "LastLoginAt"),
            CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
            Phone = GetString(reader, "Phone"),
            Notes = GetString(reader, "Notes")
        };
    }

    private static string? GetString(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static int GetInt(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? 0 : reader.GetInt32(ordinal);
    }

    private static bool GetBool(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return !reader.IsDBNull(ordinal) && reader.GetBoolean(ordinal);
    }

    private static DateTime? GetDateTime(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}
