using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// Quotes persistence: ADO.NET stored procedure calls only, no inline SQL.
// Create/Update run header + line replacement + totals recalculation inside one transaction.
public class QuoteRepository : IQuoteRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<QuoteRepository> _logger;

    public QuoteRepository(DBServices dbServices, ILogger<QuoteRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<Quote>> GetListAsync(
        string? search,
        int? customerId,
        int? projectId,
        string? status,
        DateOnly? fromDate,
        DateOnly? toDate,
        bool includeInactive)
    {
        var quotes = new List<Quote>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Quotes_GetList", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@Search", (object?)search ?? DBNull.Value);
            command.Parameters.AddWithValue("@CustomerId", (object?)customerId ?? DBNull.Value);
            command.Parameters.AddWithValue("@ProjectId", (object?)projectId ?? DBNull.Value);
            command.Parameters.AddWithValue("@Status", (object?)status ?? DBNull.Value);
            command.Parameters.AddWithValue(
                "@FromDate",
                fromDate.HasValue ? fromDate.Value.ToDateTime(TimeOnly.MinValue) : DBNull.Value);
            command.Parameters.AddWithValue(
                "@ToDate",
                toDate.HasValue ? toDate.Value.ToDateTime(TimeOnly.MinValue) : DBNull.Value);
            command.Parameters.AddWithValue("@IncludeInactive", includeInactive);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                quotes.Add(MapQuoteHeader(reader));
            }

            return quotes;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetListAsync failed with SQL error for Quotes.");
            throw new UserValidationException("Failed to retrieve quotes from the database.", ex);
        }
    }

    public async Task<Quote?> GetByIdAsync(int quoteId)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Quotes_GetById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@QuoteId", quoteId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            Quote? quote = null;
            if (await reader.ReadAsync())
            {
                quote = MapQuoteHeader(reader);
            }

            if (quote == null)
            {
                return null;
            }

            if (await reader.NextResultAsync())
            {
                while (await reader.ReadAsync())
                {
                    quote.LineItems.Add(MapQuoteLineItem(reader));
                }
            }

            return quote;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for QuoteId={QuoteId}.", quoteId);
            throw new UserValidationException("Failed to retrieve the requested quote.", ex);
        }
    }

    public async Task<int> CreateAsync(Quote quote)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var quoteId = await CreateHeaderAsync(connection, (SqlTransaction)transaction, quote);

                await ReplaceLineItemsAsync(connection, (SqlTransaction)transaction, quoteId, quote.LineItems);
                await RecalculateTotalsAsync(connection, (SqlTransaction)transaction, quoteId);

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
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for Quotes.");
            throw new UserValidationException("Failed to create quote.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Quote quote)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var rowsAffected = await UpdateHeaderAsync(connection, (SqlTransaction)transaction, quote);

                if (rowsAffected == 0)
                {
                    await transaction.RollbackAsync();
                    return false;
                }

                await ReplaceLineItemsAsync(connection, (SqlTransaction)transaction, quote.QuoteId, quote.LineItems);
                await RecalculateTotalsAsync(connection, (SqlTransaction)transaction, quote.QuoteId);

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
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for QuoteId={QuoteId}.", quote.QuoteId);
            throw new UserValidationException("Failed to update quote.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int quoteId, int? updatedByUserId)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Quotes_Deactivate", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@QuoteId", quoteId);
            command.Parameters.AddWithValue("@UpdatedByUserId", (object?)updatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeactivateAsync failed with SQL error for QuoteId={QuoteId}.", quoteId);
            throw new UserValidationException("Failed to deactivate quote.", ex);
        }
    }

    private static async Task<int> CreateHeaderAsync(SqlConnection connection, SqlTransaction transaction, Quote quote)
    {
        await using var command = new SqlCommand("dbo.sp_Quotes_Create", connection)
        {
            CommandType = CommandType.StoredProcedure,
            Transaction = transaction
        };

        command.Parameters.AddWithValue("@CustomerId", quote.CustomerId);
        command.Parameters.AddWithValue("@ProjectId", (object?)quote.ProjectId ?? DBNull.Value);
        command.Parameters.AddWithValue("@QuoteDate", quote.QuoteDate.ToDateTime(TimeOnly.MinValue));
        command.Parameters.AddWithValue(
            "@ValidUntil",
            quote.ValidUntil.HasValue ? quote.ValidUntil.Value.ToDateTime(TimeOnly.MinValue) : DBNull.Value);
        command.Parameters.AddWithValue("@Status", quote.Status);
        command.Parameters.AddWithValue("@Notes", (object?)quote.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("@VatRate", quote.VatRate);
        command.Parameters.AddWithValue("@CreatedByUserId", (object?)quote.CreatedByUserId ?? DBNull.Value);

        var result = await command.ExecuteScalarAsync();
        return result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
    }

    private static async Task<int> UpdateHeaderAsync(SqlConnection connection, SqlTransaction transaction, Quote quote)
    {
        await using var command = new SqlCommand("dbo.sp_Quotes_UpdateHeader", connection)
        {
            CommandType = CommandType.StoredProcedure,
            Transaction = transaction
        };

        command.Parameters.AddWithValue("@QuoteId", quote.QuoteId);
        command.Parameters.AddWithValue("@CustomerId", quote.CustomerId);
        command.Parameters.AddWithValue("@ProjectId", (object?)quote.ProjectId ?? DBNull.Value);
        command.Parameters.AddWithValue("@QuoteDate", quote.QuoteDate.ToDateTime(TimeOnly.MinValue));
        command.Parameters.AddWithValue(
            "@ValidUntil",
            quote.ValidUntil.HasValue ? quote.ValidUntil.Value.ToDateTime(TimeOnly.MinValue) : DBNull.Value);
        command.Parameters.AddWithValue("@Status", quote.Status);
        command.Parameters.AddWithValue("@Notes", (object?)quote.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("@VatRate", quote.VatRate);
        command.Parameters.AddWithValue("@UpdatedByUserId", (object?)quote.UpdatedByUserId ?? DBNull.Value);

        var result = await command.ExecuteScalarAsync();
        return result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
    }

    private static async Task ReplaceLineItemsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        int quoteId,
        IReadOnlyList<QuoteLineItem> lineItems)
    {
        await using (var deleteCommand = new SqlCommand("dbo.sp_Quotes_DeleteLinesByQuote", connection)
        {
            CommandType = CommandType.StoredProcedure,
            Transaction = transaction
        })
        {
            deleteCommand.Parameters.AddWithValue("@QuoteId", quoteId);
            await deleteCommand.ExecuteNonQueryAsync();
        }

        var sortOrder = 1;
        foreach (var lineItem in lineItems)
        {
            await using var addCommand = new SqlCommand("dbo.sp_Quotes_AddLine", connection)
            {
                CommandType = CommandType.StoredProcedure,
                Transaction = transaction
            };

            addCommand.Parameters.AddWithValue("@QuoteId", quoteId);
            addCommand.Parameters.AddWithValue("@Description", lineItem.Description);
            addCommand.Parameters.AddWithValue("@Quantity", lineItem.Quantity);
            addCommand.Parameters.AddWithValue("@Unit", lineItem.Unit);
            addCommand.Parameters.AddWithValue("@UnitPrice", lineItem.UnitPrice);
            addCommand.Parameters.AddWithValue("@SortOrder", sortOrder);

            await addCommand.ExecuteNonQueryAsync();
            sortOrder++;
        }
    }

    private static async Task RecalculateTotalsAsync(SqlConnection connection, SqlTransaction transaction, int quoteId)
    {
        await using var command = new SqlCommand("dbo.sp_Quotes_RecalculateTotals", connection)
        {
            CommandType = CommandType.StoredProcedure,
            Transaction = transaction
        };

        command.Parameters.AddWithValue("@QuoteId", quoteId);
        await command.ExecuteNonQueryAsync();
    }

    private static Quote MapQuoteHeader(SqlDataReader reader)
    {
        return new Quote
        {
            QuoteId = GetIntValue(reader, "QuoteId"),
            QuoteNumber = GetStringValue(reader, "QuoteNumber") ?? string.Empty,
            CustomerId = GetIntValue(reader, "CustomerId"),
            CustomerName = GetStringValue(reader, "CustomerName"),
            ProjectId = GetNullableIntValue(reader, "ProjectId"),
            ProjectTitle = GetStringValue(reader, "ProjectTitle"),
            QuoteDate = GetDateOnlyValue(reader, "QuoteDate") ?? DateOnly.MinValue,
            ValidUntil = GetDateOnlyValue(reader, "ValidUntil"),
            Status = GetStringValue(reader, "Status") ?? "Draft",
            Notes = GetStringValue(reader, "Notes"),
            VatRate = GetDecimalValue(reader, "VatRate"),
            Subtotal = GetDecimalValue(reader, "Subtotal"),
            VatAmount = GetDecimalValue(reader, "VatAmount"),
            Total = GetDecimalValue(reader, "Total"),
            IsActive = GetBoolValue(reader, "IsActive"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt")
        };
    }

    private static QuoteLineItem MapQuoteLineItem(SqlDataReader reader)
    {
        return new QuoteLineItem
        {
            QuoteLineItemId = GetIntValue(reader, "QuoteLineItemId"),
            QuoteId = GetIntValue(reader, "QuoteId"),
            Description = GetStringValue(reader, "Description") ?? string.Empty,
            Quantity = GetDecimalValue(reader, "Quantity"),
            Unit = GetStringValue(reader, "Unit") ?? string.Empty,
            UnitPrice = GetDecimalValue(reader, "UnitPrice"),
            LineTotal = GetDecimalValue(reader, "LineTotal"),
            SortOrder = GetIntValue(reader, "SortOrder")
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

    private static decimal GetDecimalValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return 0;
        }

        return Convert.ToDecimal(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return false;
        }

        return Convert.ToBoolean(reader[columnName]);
    }

    private static DateOnly? GetDateOnlyValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return DateOnly.FromDateTime(Convert.ToDateTime(reader[columnName]));
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
