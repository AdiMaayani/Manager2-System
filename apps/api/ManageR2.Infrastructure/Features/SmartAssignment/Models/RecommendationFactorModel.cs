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
    }

    // Draft (not-yet-saved) task context used to score candidates for the New Task flow.
    public class DraftTaskRecommendationContextModel
    {
        public int ProjectId { get; set; }
        public System.DateTime PlannedStart { get; set; }
        public System.DateTime PlannedEnd { get; set; }
        public decimal? EstimatedHours { get; set; }
        public string? Priority { get; set; }
        public string? RequiredRole { get; set; }
        public int? SiteId { get; set; }
    }
}
