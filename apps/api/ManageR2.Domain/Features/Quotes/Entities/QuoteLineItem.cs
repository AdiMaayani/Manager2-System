namespace ManageR2.Domain.Entities;

// Priced line of a quote. LineTotal is recomputed by the database on save.
public class QuoteLineItem
{
    public int QuoteLineItemId { get; set; }

    public int QuoteId { get; set; }

    public string Description { get; set; } = string.Empty;

    public decimal Quantity { get; set; }

    public string Unit { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }

    public decimal LineTotal { get; set; }

    public int SortOrder { get; set; }
}
