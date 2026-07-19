using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Services.SmartAssignment;

public interface ISmartAssignmentPolicyManagementService
{
    Task<IReadOnlyList<SmartAssignmentPolicyProfileRecord>> GetProfilesAsync();

    Task<IReadOnlyList<SmartAssignmentPolicyVersionRecord>> GetVersionHistoryAsync(
        SmartAssignmentProfileKey profileKey);

    Task<SmartAssignmentPolicyProfileRecord> UpdateAsync(
        SmartAssignmentProfileKey profileKey,
        SmartAssignmentPolicySnapshot policy,
        bool isActive,
        int expectedVersion,
        string? changeReason,
        SmartAssignmentPolicyActor actor);

    Task<SmartAssignmentPolicyProfileRecord> ResetAsync(
        SmartAssignmentProfileKey profileKey,
        SmartAssignmentPolicyActor actor);

    SmartAssignmentPolicyPreviewResult Preview(
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentPolicyPreviewScores scores);
}

public sealed record SmartAssignmentPolicyActor(
    int UserId,
    string? ClientIp,
    string? UserAgent);

public sealed record SmartAssignmentPolicyPreviewScores(
    decimal ProfessionalFit,
    decimal Availability,
    decimal Workload,
    decimal Geography,
    decimal Experience);

public sealed record SmartAssignmentPolicyPreviewContribution(
    string FactorCode,
    decimal Score,
    decimal WeightPercent,
    decimal WeightedContribution);

public sealed record SmartAssignmentPolicyPreviewResult(
    decimal TotalScore,
    IReadOnlyList<SmartAssignmentPolicyPreviewContribution> Contributions);

public sealed class SmartAssignmentPolicyManagementService : ISmartAssignmentPolicyManagementService
{
    private static readonly SmartAssignmentProfileKey[] SupportedProfiles =
    [
        SmartAssignmentProfileKey.Default,
        SmartAssignmentProfileKey.Regular,
        SmartAssignmentProfileKey.Project,
        SmartAssignmentProfileKey.ServiceCall
    ];

    private readonly ISmartAssignmentPolicyRepository _repository;
    private readonly ISmartAssignmentScoringEngine _scoringEngine;
    private readonly ILogger<SmartAssignmentPolicyManagementService> _logger;

    public SmartAssignmentPolicyManagementService(
        ISmartAssignmentPolicyRepository repository,
        ISmartAssignmentScoringEngine scoringEngine,
        ILogger<SmartAssignmentPolicyManagementService> logger)
    {
        _repository = repository;
        _scoringEngine = scoringEngine;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SmartAssignmentPolicyProfileRecord>> GetProfilesAsync()
    {
        var persisted = await _repository.GetProfilesAsync();
        var groupedProfiles = persisted
            .GroupBy(profile => profile.Policy.ProfileKey)
            .ToList();
        var hasInvalidState = persisted.Any(profile =>
                !SupportedProfiles.Contains(profile.Policy.ProfileKey)
                || !SmartAssignmentPolicyValidator.Validate(profile.Policy).IsValid)
            || groupedProfiles.Any(group => group.Count() != 1)
            || SupportedProfiles.Any(profileKey =>
                groupedProfiles.All(group => group.Key != profileKey));

        if (hasInvalidState)
        {
            _logger.LogError(
                "Persisted Smart Assignment settings are incomplete, duplicated, or invalid; management data will not be masked by application defaults.");
            throw new UserValidationException(
                "Smart Assignment settings are incomplete or invalid. Contact an administrator.");
        }

        var byProfile = groupedProfiles.ToDictionary(group => group.Key, group => group.Single());
        return SupportedProfiles.Select(profileKey => byProfile[profileKey]).ToList();
    }

    public Task<IReadOnlyList<SmartAssignmentPolicyVersionRecord>> GetVersionHistoryAsync(
        SmartAssignmentProfileKey profileKey) =>
        _repository.GetVersionHistoryAsync(profileKey);

    public async Task<SmartAssignmentPolicyProfileRecord> UpdateAsync(
        SmartAssignmentProfileKey profileKey,
        SmartAssignmentPolicySnapshot policy,
        bool isActive,
        int expectedVersion,
        string? changeReason,
        SmartAssignmentPolicyActor actor)
    {
        if (profileKey != policy.ProfileKey)
        {
            throw new UserValidationException("The route profile key does not match the policy body.");
        }

        if (expectedVersion < 1 || policy.Version != expectedVersion)
        {
            throw new UserValidationException("A current persisted policy version is required for update.");
        }

        if (profileKey == SmartAssignmentProfileKey.Default && !isActive)
        {
            throw new UserValidationException("The Default Smart Assignment profile must remain active.");
        }

        ValidatePolicy(policy);
        var saved = await _repository.SaveVersionAsync(new SmartAssignmentPolicySaveCommand(
            policy,
            isActive,
            expectedVersion,
            CleanOptional(changeReason),
            actor.UserId,
            actor.ClientIp,
            actor.UserAgent,
            IsReset: false));

        return new SmartAssignmentPolicyProfileRecord(saved, isActive, CleanOptional(changeReason));
    }

    public async Task<SmartAssignmentPolicyProfileRecord> ResetAsync(
        SmartAssignmentProfileKey profileKey,
        SmartAssignmentPolicyActor actor)
    {
        var profiles = await _repository.GetProfilesAsync();
        var current = profiles.SingleOrDefault(profile => profile.Policy.ProfileKey == profileKey)
            ?? throw new UserValidationException("The persisted Smart Assignment profile was not found.");

        var defaults = SmartAssignmentPolicyDefaults.Create(
            profileKey,
            version: current.Policy.Version,
            description: null);
        ValidatePolicy(defaults);

        const string resetReason = "Reset to application defaults";
        var isActiveAfterReset = profileKey == SmartAssignmentProfileKey.Default || current.IsActive;
        var saved = await _repository.SaveVersionAsync(new SmartAssignmentPolicySaveCommand(
            defaults,
            IsActive: isActiveAfterReset,
            ExpectedVersionNumber: current.Policy.Version,
            ChangeReason: resetReason,
            UpdatedByUserId: actor.UserId,
            ClientIp: actor.ClientIp,
            UserAgent: actor.UserAgent,
            IsReset: true));

        return new SmartAssignmentPolicyProfileRecord(
            saved,
            IsActive: isActiveAfterReset,
            ChangeReason: resetReason);
    }

    public SmartAssignmentPolicyPreviewResult Preview(
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentPolicyPreviewScores scores)
    {
        ValidatePolicy(policy);
        ValidatePreviewScores(scores);

        var engineResult = _scoringEngine.Preview(
            policy,
            new SmartAssignmentEnginePreviewScores(
                scores.ProfessionalFit,
                scores.Availability,
                scores.Workload,
                scores.Geography,
                scores.Experience));
        var contributions = engineResult.Contributions
            .Select(contribution => new SmartAssignmentPolicyPreviewContribution(
                contribution.FactorCode,
                contribution.Score,
                contribution.WeightPercent,
                contribution.WeightedContribution))
            .ToList();

        return new SmartAssignmentPolicyPreviewResult(engineResult.TotalScore, contributions);
    }

    private static void ValidatePolicy(SmartAssignmentPolicySnapshot policy)
    {
        var validation = SmartAssignmentPolicyValidator.Validate(policy);
        if (!validation.IsValid)
        {
            throw new UserValidationException(string.Join(" ", validation.Errors.Select(error => error.Message)));
        }
    }

    private static void ValidatePreviewScores(SmartAssignmentPolicyPreviewScores scores)
    {
        var values = new[]
        {
            scores.ProfessionalFit,
            scores.Availability,
            scores.Workload,
            scores.Geography,
            scores.Experience
        };
        if (values.Any(value => value is < 0m or > 100m))
        {
            throw new UserValidationException("All preview factor scores must be between 0 and 100.");
        }
    }

    private static string? CleanOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
