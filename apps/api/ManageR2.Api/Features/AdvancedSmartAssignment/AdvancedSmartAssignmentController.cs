using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ManageR2.Api.Authorization;
using ManageR2.Infrastructure.Services.SmartAssignment;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Controllers
{
    /// <summary>
    /// Controller להפעלת האלגוריתם והחזרת DTO נקי למנהל
    /// </summary>
    // Exposes ranked employee recommendations for one work item; delegates scoring to IAdvancedSmartAssignmentService.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = Policies.CanManageWorkPlan)]
    public class AdvancedSmartAssignmentController : ControllerBase
    {
        // Application service encapsulates algorithm + data access; controller only shapes HTTP responses.
        private readonly IAdvancedSmartAssignmentService _service;

        public AdvancedSmartAssignmentController(IAdvancedSmartAssignmentService service)
        {
            _service = service;
        }

        /// <summary>
        /// מחזיר רשימת עובדים מדורגת (DTO בלבד)
        /// </summary>
        // GET: ranked candidates for assignment planning UI (domain models mapped to slim API DTOs).
        [HttpGet("{workItemId}")]
        public async Task<IActionResult> GetRecommendations(int workItemId)
        {
            // קבלת התוצאה המלאה מהאלגוריתם
            // Unhandled exceptions intentionally propagate to the global exception handler, which returns a
            // safe RFC7807 ProblemDetails response instead of leaking raw exception messages to clients.
            var candidates = await _service.GetRecommendationsAsync(workItemId);

            // מיפוי ל-DTO (רק מה שצריך למנהל)
            // Map service candidates to API DTO: hides internal scoring breakdown, keeps rank and eligibility.
            var result = candidates
                .Select(c => new AdvancedSmartAssignmentRecommendationDto
                {
                    // דירוג
                    RankOrder = c.RankOrder,

                    // מזהים ופרטים בסיסיים
                    EmployeeId = c.EmployeeId,
                    FullName = c.FullName,
                    PrimaryRole = c.PrimaryRole,

                    // ציון כולל בלבד
                    TotalScore = c.TotalScore,

                    // כשירות
                    IsEligible = c.IsEligible,
                    ExclusionReason = c.ExclusionReason,

                    // סטטוס תצוגה נוח
                    Status = c.IsEligible
                        ? "כשיר"
                        : (string.IsNullOrWhiteSpace(c.ExclusionReason) ? "לא כשיר" : c.ExclusionReason)
                })
                // ודא מיון לפי הדירוג (אם כבר ממוין אצלך זה לא מזיק)
                .OrderBy(x => x.RankOrder ?? int.MaxValue)
                .ToList();

            return Ok(result);
        }
    }
}