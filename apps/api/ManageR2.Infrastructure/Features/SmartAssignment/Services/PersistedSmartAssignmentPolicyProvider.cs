using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Services.SmartAssignment;

public sealed class PersistedSmartAssignmentPolicyProvider : ISmartAssignmentPolicyProvider
{
    private readonly ISmartAssignmentPolicyRepository _repository;
    private readonly ILogger<PersistedSmartAssignmentPolicyProvider> _logger;
    private Task<IReadOnlyList<SmartAssignmentPolicyProfileRecord>>? _profilesTask;

    public PersistedSmartAssignmentPolicyProvider(
        ISmartAssignmentPolicyRepository repository,
        ILogger<PersistedSmartAssignmentPolicyProvider> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<SmartAssignmentPolicySnapshot> ResolveAsync(string? taskCategory)
    {
        var requestedProfile = ResolveProfileKey(taskCategory);

        try
        {
            _profilesTask ??= _repository.GetProfilesAsync();
            var profiles = await _profilesTask;
            var usableProfiles = profiles
                .Where(profile => profile.IsActive && IsValid(profile.Policy))
                .GroupBy(profile => profile.Policy.ProfileKey)
                .Where(group => group.Count() == 1)
                .ToDictionary(group => group.Key, group => group.Single().Policy);

            if (requestedProfile != SmartAssignmentProfileKey.Default
                && usableProfiles.TryGetValue(requestedProfile, out var specificPolicy))
            {
                return specificPolicy;
            }

            if (usableProfiles.TryGetValue(SmartAssignmentProfileKey.Default, out var defaultPolicy))
            {
                return defaultPolicy;
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(
                ex,
                "Persisted Smart Assignment policies could not be resolved; application defaults will be used.");
        }

        return SmartAssignmentPolicyDefaults.Create(SmartAssignmentProfileKey.Default);
    }

    internal static SmartAssignmentProfileKey ResolveProfileKey(string? taskCategory)
    {
        if (Enum.TryParse<SmartAssignmentProfileKey>(taskCategory, true, out var profileKey)
            && Enum.IsDefined(profileKey))
        {
            return profileKey;
        }

        return SmartAssignmentProfileKey.Default;
    }

    private bool IsValid(SmartAssignmentPolicySnapshot policy)
    {
        var result = SmartAssignmentPolicyValidator.Validate(policy);
        if (result.IsValid)
        {
            return true;
        }

        _logger.LogWarning(
            "Ignoring invalid persisted Smart Assignment policy {ProfileKey} version {Version}: {Errors}",
            policy.ProfileKey,
            policy.Version,
            string.Join(", ", result.Errors.Select(error => error.Code)));
        return false;
    }
}
