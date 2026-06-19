namespace ManageR2.Api.DTOs;

// UsersController POST: includes plaintext password and role/department names (never echoed back on responses).
public class CreateUserDto
{
    public int EmployeeId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string? Phone { get; set; }

    public string? Notes { get; set; }

    public List<string> Roles { get; set; } = new();

    public List<string> Departments { get; set; } = new();
}

// UsersController PUT: same surface as create; empty password means “keep existing hash” at controller layer.
public class UpdateUserDto
{
    public int EmployeeId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string? Phone { get; set; }

    public string? Notes { get; set; }

    public List<string> Roles { get; set; } = new();

    public List<string> Departments { get; set; } = new();
}

// UsersController POST /{id}/restore: admin-selected role/department names for a restored user.
// Roles is required (>=1, validated server-side); Departments may be empty.
public class RestoreUserDto
{
    public List<string> Roles { get; set; } = new();

    public List<string> Departments { get; set; } = new();
}

// Public login body: credentials only (no token returned in this type).
public class LoginRequestDto
{
    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

// Login success: JWT plus identity slices for the SPA (no password fields).
public class LoginResponseDto
{
    public int UserId { get; set; }

    public int EmployeeId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string Token { get; set; } = string.Empty;

    public List<string> Roles { get; set; } = new();

    public List<string> Departments { get; set; } = new();
}

// Admin/profile GET responses: safe user projection (hash/salt never exposed unlike domain User entity).
public class UserResponseDto
{
    public int UserId { get; set; }

    public int EmployeeId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? Phone { get; set; }

    public string? Notes { get; set; }

    public List<string> Roles { get; set; } = new();

    public List<string> Departments { get; set; } = new();
}
