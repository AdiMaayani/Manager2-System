namespace ManageR2.Api.DTOs;

// Request/response shape for ContactsController; omits CreatedBy/UpdatedBy audit ids present on Contact entity.
public class ContactDto
{
    public int ContactId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? JobTitle { get; set; }
    public string ContactCategory { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public string? CompanyName { get; set; }
    public string? Phone { get; set; }
    public string? SecondaryPhone { get; set; }
    public string? Email { get; set; }
    public string? PreferredChannel { get; set; }
    public string? City { get; set; }
    public string? Address { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
}