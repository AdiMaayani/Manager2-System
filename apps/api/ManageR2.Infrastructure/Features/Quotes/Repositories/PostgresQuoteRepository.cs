using System.Data.Common;
using System.Text.RegularExpressions;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace ManageR2.Infrastructure.Features.Quotes.Repositories;

// PostgreSQL implementation of IQuoteRepository (migration target, Wave 3). Reproduces the sp_Quotes_*
// stored procedures and the SQL Server repository's transactional orchestration: create/update run the
// header write, full line-item replacement and totals recalculation inside a single transaction.
public sealed class PostgresQuoteRepository : IQuoteRepository
{
    private static readonly string[] AllowedStatuses = { "Draft", "Sent", "Tracking", "Approved", "Rejected" };

    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresQuoteRepository> _logger;

    public PostgresQuoteRepository(PostgresConnectionFactory connectionFactory, ILogger<PostgresQuoteRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task<IEnumerable<Quote>> GetListAsync(
        string? search, int? customerId, int? projectId, string? status,
        DateOnly? fromDate, DateOnly? toDate, bool includeInactive)
    {
        var quotes = new List<Quote>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT q."QuoteId", q."QuoteNumber", q."CustomerId", c."CustomerName", q."ProjectId",
                       p."Title" AS "ProjectTitle", q."QuoteDate", q."ValidUntil", q."Status", q."Notes",
                       q."VatRate", q."Subtotal", q."VatAmount", q."Total", q."IsActive", q."CreatedAt", q."UpdatedAt"
                FROM "Quotes" q
                INNER JOIN "Customers" c ON q."CustomerId" = c."CustomerId"
                LEFT JOIN "WorkItems" p ON q."ProjectId" = p."WorkItemId"
                WHERE (@IncludeInactive = true OR q."IsActive" = true)
                  AND (@CustomerId::int IS NULL OR q."CustomerId" = @CustomerId)
                  AND (@ProjectId::int IS NULL OR q."ProjectId" = @ProjectId)
                  AND (@Status::text IS NULL OR q."Status" = @Status)
                  AND (@FromDate::date IS NULL OR q."QuoteDate" >= @FromDate)
                  AND (@ToDate::date IS NULL OR q."QuoteDate" <= @ToDate)
                  AND (
                        @Search::text IS NULL
                        OR q."QuoteNumber" ILIKE '%' || @Search || '%'
                        OR c."CustomerName" ILIKE '%' || @Search || '%'
                        OR COALESCE(p."Title", '') ILIKE '%' || @Search || '%'
                        OR COALESCE(q."Notes", '') ILIKE '%' || @Search || '%'
                      )
                ORDER BY q."QuoteDate" DESC, q."QuoteId" DESC
                """;

            AddParameter(command, "@Search", (object?)NormalizeString(search) ?? DBNull.Value);
            AddParameter(command, "@CustomerId", (object?)customerId ?? DBNull.Value);
            AddParameter(command, "@ProjectId", (object?)projectId ?? DBNull.Value);
            AddParameter(command, "@Status", (object?)NormalizeString(status) ?? DBNull.Value);
            AddParameter(command, "@FromDate", (object?)fromDate ?? DBNull.Value);
            AddParameter(command, "@ToDate", (object?)toDate ?? DBNull.Value);
            AddParameter(command, "@IncludeInactive", includeInactive);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                quotes.Add(MapQuoteHeader(reader));
            }

            return quotes;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "GetListAsync failed with SQL error for Quotes.");
            throw new UserValidationException("Failed to retrieve quotes from the database.", ex);
        }
    }

    public async Task<Quote?> GetByIdAsync(int quoteId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            Quote? quote;
            await using (var headerCommand = connection.CreateCommand())
            {
                headerCommand.CommandText =
                    """
                    SELECT q."QuoteId", q."QuoteNumber", q."CustomerId", c."CustomerName", q."ProjectId",
                           p."Title" AS "ProjectTitle", q."QuoteDate", q."ValidUntil", q."Status", q."Notes",
                           q."VatRate", q."Subtotal", q."VatAmount", q."Total", q."IsActive", q."CreatedAt", q."UpdatedAt"
                    FROM "Quotes" q
                    INNER JOIN "Customers" c ON q."CustomerId" = c."CustomerId"
                    LEFT JOIN "WorkItems" p ON q."ProjectId" = p."WorkItemId"
                    WHERE q."QuoteId" = @QuoteId
                    """;
                AddParameter(headerCommand, "@QuoteId", quoteId);
                await using var reader = await headerCommand.ExecuteReaderAsync();
                quote = await reader.ReadAsync() ? MapQuoteHeader(reader) : null;
            }

            if (quote is null)
            {
                return null;
            }

            await using (var linesCommand = connection.CreateCommand())
            {
                linesCommand.CommandText =
                    """
                    SELECT li."QuoteLineItemId", li."QuoteId", li."Description", li."Quantity", li."Unit",
                           li."UnitPrice", li."LineTotal", li."SortOrder"
                    FROM "QuoteLineItems" li
                    WHERE li."QuoteId" = @QuoteId
                    ORDER BY li."SortOrder" ASC, li."QuoteLineItemId" ASC
                    """;
                AddParameter(linesCommand, "@QuoteId", quoteId);
                await using var reader = await linesCommand.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    quote.LineItems.Add(MapQuoteLineItem(reader));
                }
            }

            return quote;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for QuoteId={QuoteId}.", quoteId);
            throw new UserValidationException("Failed to retrieve the requested quote.", ex);
        }
    }

    public async Task<int> CreateAsync(Quote quote)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var quoteId = await CreateHeaderAsync(connection, transaction, quote);
                await ReplaceLineItemsAsync(connection, transaction, quoteId, quote.LineItems);
                await RecalculateTotalsAsync(connection, transaction, quoteId);
                await transaction.CommitAsync();

                _logger.LogInformation("CreateAsync succeeded. Created QuoteId={QuoteId}.", quoteId);
                return quoteId;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex) when (ex is DbException or QuoteValidationException)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for Quotes.");
            throw new UserValidationException("Failed to create quote.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Quote quote)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var rowsAffected = await UpdateHeaderAsync(connection, transaction, quote);
                if (rowsAffected == 0)
                {
                    await transaction.RollbackAsync();
                    return false;
                }

                await ReplaceLineItemsAsync(connection, transaction, quote.QuoteId, quote.LineItems);
                await RecalculateTotalsAsync(connection, transaction, quote.QuoteId);
                await transaction.CommitAsync();

                _logger.LogInformation("UpdateAsync succeeded for QuoteId={QuoteId}.", quote.QuoteId);
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex) when (ex is DbException or QuoteValidationException)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for QuoteId={QuoteId}.", quote.QuoteId);
            throw new UserValidationException("Failed to update quote.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int quoteId, int? updatedByUserId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Quotes"
                SET "IsActive" = false, "UpdatedAt" = (now() at time zone 'utc'),
                    "UpdatedByUserId" = @UpdatedByUserId, "DeletedAt" = (now() at time zone 'utc')
                WHERE "QuoteId" = @QuoteId AND "IsActive" = true
                """;
            AddParameter(command, "@QuoteId", quoteId);
            AddParameter(command, "@UpdatedByUserId", (object?)updatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "DeactivateAsync failed with SQL error for QuoteId={QuoteId}.", quoteId);
            throw new UserValidationException("Failed to deactivate quote.", ex);
        }
    }

    // Mirrors sp_Quotes_Create: validation + Q-YYYY-#### number generation + zeroed totals.
    private static async Task<int> CreateHeaderAsync(DbConnection connection, DbTransaction transaction, Quote quote)
    {
        var normalizedStatus = NormalizeString(quote.Status) ?? "Draft";

        if (!await ExistsAsync(connection, transaction, """SELECT 1 FROM "Customers" WHERE "CustomerId" = @c""", ("@c", quote.CustomerId)))
        {
            throw new QuoteValidationException("Customer was not found.");
        }

        if (quote.ProjectId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "WorkItems" WHERE "WorkItemId" = @p AND "WorkType" = 'Project'""", ("@p", quote.ProjectId.Value)))
        {
            throw new QuoteValidationException("Project was not found.");
        }

        if (!AllowedStatuses.Contains(normalizedStatus))
        {
            throw new QuoteValidationException("Status is invalid.");
        }

        if (quote.VatRate < 0)
        {
            throw new QuoteValidationException("VatRate cannot be negative.");
        }

        var year = DateTime.UtcNow.Year;
        var prefix = $"Q-{year}-";
        var pattern = "^" + Regex.Escape(prefix) + "[0-9]{4}$";

        int nextSequence;
        await using (var sequenceCommand = connection.CreateCommand())
        {
            sequenceCommand.Transaction = transaction;
            sequenceCommand.CommandText =
                """SELECT COALESCE(MAX(CAST(RIGHT("QuoteNumber", 4) AS integer)), 0) + 1 FROM "Quotes" WHERE "QuoteNumber" ~ @pattern""";
            AddParameter(sequenceCommand, "@pattern", pattern);
            var scalar = await sequenceCommand.ExecuteScalarAsync();
            nextSequence = scalar is null or DBNull ? 1 : Convert.ToInt32(scalar);
        }

        var padded = "0000" + nextSequence.ToString();
        var quoteNumber = prefix + padded[^4..];

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            INSERT INTO "Quotes"
                ("QuoteNumber", "CustomerId", "ProjectId", "QuoteDate", "ValidUntil", "Status", "Notes", "VatRate",
                 "Subtotal", "VatAmount", "Total", "IsActive", "CreatedAt", "CreatedByUserId")
            VALUES
                (@QuoteNumber, @CustomerId, @ProjectId, @QuoteDate, @ValidUntil, @Status, @Notes, @VatRate,
                 0, 0, 0, true, (now() at time zone 'utc'), @CreatedByUserId)
            RETURNING "QuoteId"
            """;
        AddParameter(command, "@QuoteNumber", quoteNumber);
        AddParameter(command, "@CustomerId", quote.CustomerId);
        AddParameter(command, "@ProjectId", (object?)quote.ProjectId ?? DBNull.Value);
        AddParameter(command, "@QuoteDate", quote.QuoteDate);
        AddParameter(command, "@ValidUntil", (object?)quote.ValidUntil ?? DBNull.Value);
        AddParameter(command, "@Status", normalizedStatus);
        AddParameter(command, "@Notes", (object?)NormalizeString(quote.Notes) ?? DBNull.Value);
        AddParameter(command, "@VatRate", quote.VatRate);
        AddParameter(command, "@CreatedByUserId", (object?)quote.CreatedByUserId ?? DBNull.Value);

        var result = await command.ExecuteScalarAsync();
        return result is null or DBNull ? 0 : Convert.ToInt32(result);
    }

    // Mirrors sp_Quotes_UpdateHeader: validation + header update; returns rows affected.
    private static async Task<int> UpdateHeaderAsync(DbConnection connection, DbTransaction transaction, Quote quote)
    {
        var normalizedStatus = NormalizeString(quote.Status) ?? "Draft";

        if (!await ExistsAsync(connection, transaction, """SELECT 1 FROM "Quotes" WHERE "QuoteId" = @q AND "IsActive" = true""", ("@q", quote.QuoteId)))
        {
            throw new QuoteValidationException("Quote was not found.");
        }

        if (!await ExistsAsync(connection, transaction, """SELECT 1 FROM "Customers" WHERE "CustomerId" = @c""", ("@c", quote.CustomerId)))
        {
            throw new QuoteValidationException("Customer was not found.");
        }

        if (quote.ProjectId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "WorkItems" WHERE "WorkItemId" = @p AND "WorkType" = 'Project'""", ("@p", quote.ProjectId.Value)))
        {
            throw new QuoteValidationException("Project was not found.");
        }

        if (!AllowedStatuses.Contains(normalizedStatus))
        {
            throw new QuoteValidationException("Status is invalid.");
        }

        if (quote.VatRate < 0)
        {
            throw new QuoteValidationException("VatRate cannot be negative.");
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            UPDATE "Quotes"
            SET "CustomerId" = @CustomerId, "ProjectId" = @ProjectId, "QuoteDate" = @QuoteDate,
                "ValidUntil" = @ValidUntil, "Status" = @Status, "Notes" = @Notes, "VatRate" = @VatRate,
                "UpdatedAt" = (now() at time zone 'utc'), "UpdatedByUserId" = @UpdatedByUserId
            WHERE "QuoteId" = @QuoteId
            """;
        AddParameter(command, "@QuoteId", quote.QuoteId);
        AddParameter(command, "@CustomerId", quote.CustomerId);
        AddParameter(command, "@ProjectId", (object?)quote.ProjectId ?? DBNull.Value);
        AddParameter(command, "@QuoteDate", quote.QuoteDate);
        AddParameter(command, "@ValidUntil", (object?)quote.ValidUntil ?? DBNull.Value);
        AddParameter(command, "@Status", normalizedStatus);
        AddParameter(command, "@Notes", (object?)NormalizeString(quote.Notes) ?? DBNull.Value);
        AddParameter(command, "@VatRate", quote.VatRate);
        AddParameter(command, "@UpdatedByUserId", (object?)quote.UpdatedByUserId ?? DBNull.Value);

        return await command.ExecuteNonQueryAsync();
    }

    private static async Task ReplaceLineItemsAsync(
        DbConnection connection, DbTransaction transaction, int quoteId, IReadOnlyList<QuoteLineItem> lineItems)
    {
        await using (var deleteCommand = connection.CreateCommand())
        {
            deleteCommand.Transaction = transaction;
            deleteCommand.CommandText = """DELETE FROM "QuoteLineItems" WHERE "QuoteId" = @QuoteId""";
            AddParameter(deleteCommand, "@QuoteId", quoteId);
            await deleteCommand.ExecuteNonQueryAsync();
        }

        var sortOrder = 1;
        foreach (var lineItem in lineItems)
        {
            await AddLineAsync(connection, transaction, quoteId, lineItem, sortOrder);
            sortOrder++;
        }
    }

    // Mirrors sp_Quotes_AddLine: validation, trimmed text, LineTotal = ROUND(Quantity * UnitPrice, 2).
    private static async Task AddLineAsync(
        DbConnection connection, DbTransaction transaction, int quoteId, QuoteLineItem lineItem, int sortOrder)
    {
        if (!await ExistsAsync(connection, transaction, """SELECT 1 FROM "Quotes" WHERE "QuoteId" = @q""", ("@q", quoteId)))
        {
            throw new QuoteValidationException("Quote was not found.");
        }

        if (string.IsNullOrWhiteSpace(lineItem.Description))
        {
            throw new QuoteValidationException("Line description is required.");
        }

        if (string.IsNullOrWhiteSpace(lineItem.Unit))
        {
            throw new QuoteValidationException("Line unit is required.");
        }

        if (lineItem.Quantity < 0)
        {
            throw new QuoteValidationException("Line quantity cannot be negative.");
        }

        if (lineItem.UnitPrice < 0)
        {
            throw new QuoteValidationException("Line unit price cannot be negative.");
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            INSERT INTO "QuoteLineItems"
                ("QuoteId", "Description", "Quantity", "Unit", "UnitPrice", "LineTotal", "SortOrder", "CreatedAt")
            VALUES
                (@QuoteId, @Description, @Quantity, @Unit, @UnitPrice, ROUND(@Quantity * @UnitPrice, 2), @SortOrder,
                 (now() at time zone 'utc'))
            """;
        AddParameter(command, "@QuoteId", quoteId);
        AddParameter(command, "@Description", lineItem.Description.Trim());
        AddParameter(command, "@Quantity", lineItem.Quantity);
        AddParameter(command, "@Unit", lineItem.Unit.Trim());
        AddParameter(command, "@UnitPrice", lineItem.UnitPrice);
        AddParameter(command, "@SortOrder", sortOrder);
        await command.ExecuteNonQueryAsync();
    }

    // Mirrors sp_Quotes_RecalculateTotals.
    private static async Task RecalculateTotalsAsync(DbConnection connection, DbTransaction transaction, int quoteId)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            UPDATE "Quotes" q
            SET "Subtotal" = t."Subtotal",
                "VatAmount" = ROUND(t."Subtotal" * q."VatRate" / 100.0, 2),
                "Total" = t."Subtotal" + ROUND(t."Subtotal" * q."VatRate" / 100.0, 2),
                "UpdatedAt" = (now() at time zone 'utc')
            FROM (
                SELECT COALESCE(SUM("LineTotal"), 0) AS "Subtotal"
                FROM "QuoteLineItems" WHERE "QuoteId" = @QuoteId
            ) t
            WHERE q."QuoteId" = @QuoteId
            """;
        AddParameter(command, "@QuoteId", quoteId);
        var rowsAffected = await command.ExecuteNonQueryAsync();
        if (rowsAffected == 0)
        {
            throw new QuoteValidationException("Quote was not found.");
        }
    }

    private static string? NormalizeString(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static async Task<bool> ExistsAsync(
        DbConnection connection, DbTransaction transaction, string sql, params (string Name, object Value)[] parameters)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
        {
            AddParameter(command, name, value);
        }

        var result = await command.ExecuteScalarAsync();
        return result is not null && result != DBNull.Value;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static Quote MapQuoteHeader(DbDataReader reader) => new()
    {
        QuoteId = GetInt(reader, "QuoteId"),
        QuoteNumber = GetString(reader, "QuoteNumber") ?? string.Empty,
        CustomerId = GetInt(reader, "CustomerId"),
        CustomerName = GetString(reader, "CustomerName"),
        ProjectId = GetNullableInt(reader, "ProjectId"),
        ProjectTitle = GetString(reader, "ProjectTitle"),
        QuoteDate = GetDateOnly(reader, "QuoteDate") ?? DateOnly.MinValue,
        ValidUntil = GetDateOnly(reader, "ValidUntil"),
        Status = GetString(reader, "Status") ?? "Draft",
        Notes = GetString(reader, "Notes"),
        VatRate = GetDecimal(reader, "VatRate"),
        Subtotal = GetDecimal(reader, "Subtotal"),
        VatAmount = GetDecimal(reader, "VatAmount"),
        Total = GetDecimal(reader, "Total"),
        IsActive = GetBool(reader, "IsActive"),
        CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
        UpdatedAt = GetDateTime(reader, "UpdatedAt")
    };

    private static QuoteLineItem MapQuoteLineItem(DbDataReader reader) => new()
    {
        QuoteLineItemId = GetInt(reader, "QuoteLineItemId"),
        QuoteId = GetInt(reader, "QuoteId"),
        Description = GetString(reader, "Description") ?? string.Empty,
        Quantity = GetDecimal(reader, "Quantity"),
        Unit = GetString(reader, "Unit") ?? string.Empty,
        UnitPrice = GetDecimal(reader, "UnitPrice"),
        LineTotal = GetDecimal(reader, "LineTotal"),
        SortOrder = GetInt(reader, "SortOrder")
    };

    private static string? GetString(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetValue(ordinal)?.ToString();
    }

    private static int GetInt(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? 0 : Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static int? GetNullableInt(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static decimal GetDecimal(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? 0 : Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static bool GetBool(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return !reader.IsDBNull(ordinal) && Convert.ToBoolean(reader.GetValue(ordinal));
    }

    private static DateTime? GetDateTime(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : Convert.ToDateTime(reader.GetValue(ordinal));
    }

    private static DateOnly? GetDateOnly(DbDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var value = reader.GetValue(ordinal);
        return value switch
        {
            DateOnly dateOnly => dateOnly,
            DateTime dateTime => DateOnly.FromDateTime(dateTime),
            _ => DateOnly.FromDateTime(Convert.ToDateTime(value))
        };
    }

    // Internal marker so header/line validation failures are wrapped into UserValidationException exactly
    // like the SQL Server path wraps THROW-originated SqlExceptions.
    private sealed class QuoteValidationException : Exception
    {
        public QuoteValidationException(string message) : base(message)
        {
        }
    }
}
