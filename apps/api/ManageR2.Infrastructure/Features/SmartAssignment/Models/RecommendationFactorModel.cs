using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // One explainability factor behind a candidate's score: what it measured, the score/weight, a
    // human-readable explanation, the data source used, and whether the underlying data was available.
    public class RecommendationFactorModel
    {
        // Stable key, e.g. "professional", "availability", "workload", "geographic", "experience".
        public string Key { get; set; } = string.Empty;

        // Human-readable label (Hebrew) for display.
        public string Label { get; set; } = string.Empty;

        // 0–100 factor score, or null when the factor could not be computed from available data.
        public decimal? Score { get; set; }

        // Relative weight of this factor in the total score (percent).
        public decimal WeightPercent { get; set; }

        // Human-readable explanation of why this score was given.
        public string Explanation { get; set; } = string.Empty;

        // Where the data came from (e.g. employee skills, availability calendar, route estimates).
        public string DataSource { get; set; } = string.Empty;

        // False when the required data was missing and a neutral/placeholder value was used instead.
        public bool HasData { get; set; }

        // Exact contribution to TotalScore: Score * WeightPercent / 100.
        public decimal WeightedContribution { get; set; }

        // True when the policy's configured missing-data/default score was used.
        public bool IsDefaulted { get; set; }

        // Stable machine-readable missing-input codes associated with this factor.
        public List<string> MissingInputCodes { get; set; } = new();

        // Non-sensitive source values used to explain and reproduce the score.
        public Dictionary<string, object?> SourceValues { get; set; } = new();
    }

    // Draft (not-yet-saved) task context used to score candidates for the New Task flow.
    public class DraftTaskRecommendationContextModel
    {
        public string TaskCategory { get; set; } = string.Empty;
        public int? ProjectId { get; set; }
        public int? CustomerId { get; set; }
        public System.DateTime PlannedStart { get; set; }
        public System.DateTime PlannedEnd { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Priority { get; set; }
        public string? RequiredRole { get; set; }
        public List<string>? RequiredRoles { get; set; }
        public int? SiteId { get; set; }

        // Optional request-scoped weights; used only to build the effective in-memory policy snapshot.
        public SmartAssignmentWeights? WeightsOverride { get; set; }
    }
}
