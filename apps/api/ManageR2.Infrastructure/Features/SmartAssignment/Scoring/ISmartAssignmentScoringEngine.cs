using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Features.SmartAssignment.Scoring;

public interface ISmartAssignmentScoringEngine
{
    SmartAssignmentEvaluationResult Evaluate(
        TaskRecommendationInputModel input,
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentEvaluationContext context);

    SmartAssignmentEnginePreviewResult Preview(
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentEnginePreviewScores scores);
}

public sealed record SmartAssignmentEnginePreviewScores(
    decimal ProfessionalFit,
    decimal Availability,
    decimal Workload,
    decimal Geography,
    decimal Experience);

public sealed record SmartAssignmentEnginePreviewContribution(
    string FactorCode,
    decimal Score,
    decimal WeightPercent,
    decimal WeightedContribution);

public sealed record SmartAssignmentEnginePreviewResult(
    decimal TotalScore,
    IReadOnlyList<SmartAssignmentEnginePreviewContribution> Contributions);
