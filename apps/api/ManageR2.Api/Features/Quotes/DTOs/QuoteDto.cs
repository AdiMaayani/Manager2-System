namespace ManageR2.Api.DTOs;

// Compact row for the quotes list/grid screens.
public class QuoteListItemDto
{
    public int QuoteId { get; set; }

    public string QuoteNumber { get; set; } = string.Empty;

    public int CustomerId { get; set; }

    public string? CustomerName { get; set; }

    public int? ProjectId { get; set; }

    public string? ProjectTitle { get; set; }

    public DateOnly QuoteDate { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public string Status { get; set; } = "Draft";

    public decimal VatRate { get; set; }

    public decimal Subtotal { get; set; }

    public decimal VatAmount { get; set; }

    public decimal Total { get; set; }

    public bool IsActive { get; set; }
}

// Full quote with header and line items for the detail/edit drawer.
public class QuoteDetailsDto
{
    public int QuoteId { get; set; }

    public string QuoteNumber { get; set; } = string.Empty;

    public int CustomerId { get; set; }

    public string? CustomerName { get; set; }

    public int? ProjectId { get; set; }

    public string? ProjectTitle { get; set; }

    public DateOnly QuoteDate { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public string Status { get; set; } = "Draft";

    public string? Notes { get; set; }

    public decimal VatRate { get; set; }

    public decimal Subtotal { get; set; }

    public decimal VatAmount { get; set; }

    public decimal Total { get; set; }

    public bool IsActive { get; set; }

    public List<QuoteLineItemDto> LineItems { get; set; } = new();
}

public class QuoteLineItemDto
{
    public int QuoteLineItemId { get; set; }

    public string Description { get; set; } = string.Empty;

    public decimal Quantity { get; set; }

    public string Unit { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }

    public decimal LineTotal { get; set; }

    public int SortOrder { get; set; }
}

public class CreateQuoteRequestDto
{
    public int CustomerId { get; set; }

    public int? ProjectId { get; set; }

    public DateOnly QuoteDate { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public string Status { get; set; } = "Draft";

    public string? Notes { get; set; }

    public decimal VatRate { get; set; } = 17.00m;

    public List<QuoteLineItemRequestDto> LineItems { get; set; } = new();
}

public class UpdateQuoteRequestDto
{
    public int CustomerId { get; set; }

    public int? ProjectId { get; set; }

    public DateOnly QuoteDate { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public string Status { get; set; } = "Draft";

    public string? Notes { get; set; }

    public decimal VatRate { get; set; } = 17.00m;

    public List<QuoteLineItemRequestDto> LineItems { get; set; } = new();
}

public class QuoteLineItemRequestDto
{
    public string Description { get; set; } = string.Empty;

    public decimal Quantity { get; set; }

    public string Unit { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }

    public int? SortOrder { get; set; }
}
