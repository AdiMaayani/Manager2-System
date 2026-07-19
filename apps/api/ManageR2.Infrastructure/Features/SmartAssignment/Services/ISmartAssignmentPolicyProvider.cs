using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Infrastructure.Services.SmartAssignment;

public interface ISmartAssignmentPolicyProvider
{
    Task<SmartAssignmentPolicySnapshot> ResolveAsync(string? taskCategory);
}
