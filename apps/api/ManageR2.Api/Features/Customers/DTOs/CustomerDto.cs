namespace ManageR2.Api.DTOs;

// CustomersController uses this for list/detail/create/update; excludes audit timestamps and user ids from domain Customer.
public class CustomerDto
{
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerType { get; set; } = string.Empty;
    public string? PrimaryPhone { get; set; }
    public string? PrimaryEmail { get; set; }
    public string? City { get; set; }
    public string? Region { get; set; }
    public string? Address { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
}