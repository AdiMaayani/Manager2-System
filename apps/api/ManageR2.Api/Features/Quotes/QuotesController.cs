using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Quotes: customer/project price quotes with priced line items; backed by IQuoteRepository (stored procedures only).
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewQuotes)]
public class QuotesController : ControllerBase
{
    private static readonly string[] AllowedStatuses =
    {
        "Draft", "Sent", "Tracking", "Approved", "Rejected"
    };

    private readonly IQuoteRepository _repository;

    public QuotesController(IQuoteRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? search,
        [FromQuery] int? customerId,
        [FromQuery] int? projectId,
        [FromQuery] string? status,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] bool includeInactive = false)
    {
        try
        {
            var quotes = await _repository.GetListAsync(
                search,
                customerId,
                projectId,
                status,
                fromDate,
                toDate,
                includeInactive);

            return Ok(quotes.Select(MapToListItemDto));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var quote = await _repository.GetByIdAsync(id);

            if (quote == null)
            {
                return NotFound(new { message = $"Quote with id {id} was not found." });
            }

            return Ok(MapToDetailsDto(quote));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageQuotes)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuoteRequestDto dto)
    {
        var validationError = ValidateRequest(dto.CustomerId, dto.Status, dto.VatRate, dto.LineItems);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var quote = MapToEntity(dto.CustomerId, dto.ProjectId, dto.QuoteDate, dto.ValidUntil, dto.Status, dto.Notes, dto.VatRate, dto.LineItems);
            quote.CreatedByUserId = currentUserId;

            var id = await _repository.CreateAsync(quote);

            var created = await _repository.GetByIdAsync(id);
            if (created == null)
            {
                return BadRequest(new { message = "Quote was created but could not be reloaded." });
            }

            return CreatedAtAction(nameof(GetById), new { id }, MapToDetailsDto(created));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageQuotes)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateQuoteRequestDto dto)
    {
        var validationError = ValidateRequest(dto.CustomerId, dto.Status, dto.VatRate, dto.LineItems);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Quote with id {id} was not found." });
            }

            var quote = MapToEntity(dto.CustomerId, dto.ProjectId, dto.QuoteDate, dto.ValidUntil, dto.Status, dto.Notes, dto.VatRate, dto.LineItems);
            quote.QuoteId = id;
            quote.UpdatedByUserId = currentUserId;

            var success = await _repository.UpdateAsync(quote);
            if (!success)
            {
                return BadRequest(new { message = "Failed to update quote." });
            }

            var updated = await _repository.GetByIdAsync(id);
            if (updated == null)
            {
                return NotFound(new { message = $"Quote with id {id} was not found after update." });
            }

            return Ok(MapToDetailsDto(updated));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageQuotes)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Quote with id {id} was not found." });
            }

            var success = await _repository.DeactivateAsync(id, currentUserId);
            if (!success)
            {
                return BadRequest(new { message = "Failed to deactivate quote." });
            }

            return Ok(new { message = "Quote deactivated successfully." });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private bool TryGetCurrentUserId(out int userId)
    {
        userId = 0;
        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        return !string.IsNullOrWhiteSpace(currentUserIdClaim) && int.TryParse(currentUserIdClaim, out userId);
    }

    private static string? ValidateRequest(
        int customerId,
        string status,
        decimal vatRate,
        IReadOnlyList<QuoteLineItemRequestDto> lineItems)
    {
        if (customerId <= 0)
        {
            return "Customer is required.";
        }

        if (string.IsNullOrWhiteSpace(status) || !AllowedStatuses.Contains(status))
        {
            return "Status is invalid.";
        }

        if (vatRate < 0)
        {
            return "VatRate cannot be negative.";
        }

        foreach (var lineItem in lineItems)
        {
            if (string.IsNullOrWhiteSpace(lineItem.Description))
            {
                return "Each line item requires a description.";
            }

            if (string.IsNullOrWhiteSpace(lineItem.Unit))
            {
                return "Each line item requires a unit.";
            }

            if (lineItem.Quantity < 0)
            {
                return "Line quantity cannot be negative.";
            }

            if (lineItem.UnitPrice < 0)
            {
                return "Line unit price cannot be negative.";
            }
        }

        return null;
    }

    private static Quote MapToEntity(
        int customerId,
        int? projectId,
        DateOnly quoteDate,
        DateOnly? validUntil,
        string status,
        string? notes,
        decimal vatRate,
        IReadOnlyList<QuoteLineItemRequestDto> lineItems)
    {
        return new Quote
        {
            CustomerId = customerId,
            ProjectId = projectId,
            QuoteDate = quoteDate,
            ValidUntil = validUntil,
            Status = status,
            Notes = notes,
            VatRate = vatRate,
            LineItems = lineItems.Select(line => new QuoteLineItem
            {
                Description = line.Description,
                Quantity = line.Quantity,
                Unit = line.Unit,
                UnitPrice = line.UnitPrice,
                SortOrder = line.SortOrder ?? 0
            }).ToList()
        };
    }

    private static QuoteListItemDto MapToListItemDto(Quote quote)
    {
        return new QuoteListItemDto
        {
            QuoteId = quote.QuoteId,
            QuoteNumber = quote.QuoteNumber,
            CustomerId = quote.CustomerId,
            CustomerName = quote.CustomerName,
            ProjectId = quote.ProjectId,
            ProjectTitle = quote.ProjectTitle,
            QuoteDate = quote.QuoteDate,
            ValidUntil = quote.ValidUntil,
            Status = quote.Status,
            VatRate = quote.VatRate,
            Subtotal = quote.Subtotal,
            VatAmount = quote.VatAmount,
            Total = quote.Total,
            IsActive = quote.IsActive
        };
    }

    private static QuoteDetailsDto MapToDetailsDto(Quote quote)
    {
        return new QuoteDetailsDto
        {
            QuoteId = quote.QuoteId,
            QuoteNumber = quote.QuoteNumber,
            CustomerId = quote.CustomerId,
            CustomerName = quote.CustomerName,
            ProjectId = quote.ProjectId,
            ProjectTitle = quote.ProjectTitle,
            QuoteDate = quote.QuoteDate,
            ValidUntil = quote.ValidUntil,
            Status = quote.Status,
            Notes = quote.Notes,
            VatRate = quote.VatRate,
            Subtotal = quote.Subtotal,
            VatAmount = quote.VatAmount,
            Total = quote.Total,
            IsActive = quote.IsActive,
            LineItems = quote.LineItems.Select(line => new QuoteLineItemDto
            {
                QuoteLineItemId = line.QuoteLineItemId,
                Description = line.Description,
                Quantity = line.Quantity,
                Unit = line.Unit,
                UnitPrice = line.UnitPrice,
                LineTotal = line.LineTotal,
                SortOrder = line.SortOrder
            }).ToList()
        };
    }
}
