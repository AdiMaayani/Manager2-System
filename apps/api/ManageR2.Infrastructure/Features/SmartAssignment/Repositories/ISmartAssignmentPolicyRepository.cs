using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Infrastructure.Features.SmartAssignment.Repositories;

public interface ISmartAssignmentPolicyRepository
{
    Task<IReadOnlyList<SmartAssignmentPolicyProfileRecord>> GetProfilesAsync();

    Task<IReadOnlyList<SmartAssignmentPolicyVersionRecord>> GetVersionHistoryAsync(
        SmartAssignmentProfileKey profileKey);

    Task<SmartAssignmentPolicySnapshot> SaveVersionAsync(SmartAssignmentPolicySaveCommand command);
}

public sealed record SmartAssignmentPolicyVersionRecord(
    SmartAssignmentPolicySnapshot Policy,
    bool IsProfileActive,
    bool IsCurrentVersion,
    string? ChangeReason);

public sealed record SmartAssignmentPolicyProfileRecord(
    SmartAssignmentPolicySnapshot Policy,
    bool IsActive,
    string? ChangeReason);

public sealed record SmartAssignmentPolicySaveCommand(
    SmartAssignmentPolicySnapshot Policy,
    bool IsActive,
    int ExpectedVersionNumber,
    string? ChangeReason,
    int UpdatedByUserId,
    string? ClientIp,
    string? UserAgent,
    bool IsReset);
