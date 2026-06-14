namespace ManageR2.Api.DTOs;

public class EmployeeDto
{
    public int EmployeeId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string PrimaryRole { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public string? Email { get; set; }

    public decimal? DailyCapacityHours { get; set; }

    public bool IsAssignable { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}

// Minimal employee projection for selection pickers/scheduling. Intentionally omits contact PII
// (Phone, Email) and audit fields (CreatedAt) returned by the full EmployeeDto.
public class EmployeeLookupDto
{
    public int EmployeeId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string PrimaryRole { get; set; } = string.Empty;

    public decimal? DailyCapacityHours { get; set; }

    public bool IsAssignable { get; set; }

    public bool IsActive { get; set; }
}

public class UpsertEmployeeRequestDto
{
    public string FullName { get; set; } = string.Empty;

    public string PrimaryRole { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public string? Email { get; set; }

    public decimal? DailyCapacityHours { get; set; }

    public bool IsAssignable { get; set; } = true;

    public bool IsActive { get; set; } = true;
}

public class SetEmployeeActiveStatusRequestDto
{
    public bool IsActive { get; set; }
}
