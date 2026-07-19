using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Infrastructure.Models.SmartAssignment;

public sealed record SimulatedWorkloadAdjustment(
    decimal AdditionalAssignedHours,
    int AdditionalAssignments);

/// <summary>
/// Run-specific facts that may affect scoring without changing persisted input data.
/// </summary>
public sealed record SmartAssignmentEvaluationContext(
    DateTime CurrentDate,
    IReadOnlyDictionary<int, SimulatedWorkloadAdjustment> SimulatedWorkloadByEmployee,
    SmartAssignmentWeights? WeightsOverride = null)
{
    public static SmartAssignmentEvaluationContext Empty(DateTime currentDate) =>
        new(currentDate.Date, new Dictionary<int, SimulatedWorkloadAdjustment>());

    public SimulatedWorkloadAdjustment GetSimulatedWorkload(int employeeId) =>
        SimulatedWorkloadByEmployee.TryGetValue(employeeId, out var adjustment)
            ? adjustment
            : new SimulatedWorkloadAdjustment(0m, 0);
}

public sealed record RecommendationRejectionModel(
    string Code,
    string Explanation);

public sealed record SmartAssignmentEvaluationResult(
    SmartAssignmentPolicySnapshot Policy,
    IReadOnlyList<EmployeeCandidateModel> Candidates);
