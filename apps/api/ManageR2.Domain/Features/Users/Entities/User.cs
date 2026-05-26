namespace ManageR2.Domain.Entities;

// Application login identity: ties to EmployeeId for HR/workforce data; roles/departments live in related tables.
public class User
{
    public int UserId { get; set; }

    public int EmployeeId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    // Never sent to clients; UserResponseDto / LoginResponseDto omit secrets while still using this entity server-side.
    public string PasswordHash { get; set; } = string.Empty;

    public string PasswordSalt { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? Phone { get; set; }

    public string? Notes { get; set; }
}