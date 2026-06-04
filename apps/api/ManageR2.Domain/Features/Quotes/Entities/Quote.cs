namespace ManageR2.Domain.Entities;

// Quote header linked to a customer and optionally to a project (WorkItems with WorkType='Project').
public class Quote
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

    public DateTime CreatedAt { get; set; }

    public int? CreatedByUserId { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int? UpdatedByUserId { get; set; }

    public List<QuoteLineItem> LineItems { get; set; } = new();
}
