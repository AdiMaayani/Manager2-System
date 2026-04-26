using Microsoft.AspNetCore.Mvc;
using ManageR2.Infrastructure.Services.SmartAssignment;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Controllers
{
    /// <summary>
    /// Controller להפעלת האלגוריתם והחזרת DTO נקי למנהל
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AdvancedSmartAssignmentController : ControllerBase
    {
        private readonly IAdvancedSmartAssignmentService _service;

        public AdvancedSmartAssignmentController(IAdvancedSmartAssignmentService service)
        {
            _service = service;
        }

        /// <summary>
        /// מחזיר רשימת עובדים מדורגת (DTO בלבד)
        /// </summary>
        [HttpGet("{workItemId}")]
        public async Task<IActionResult> GetRecommendations(int workItemId)
        {
            try
            {
                // קבלת התוצאה המלאה מהאלגוריתם
                var candidates = await _service.GetRecommendationsAsync(workItemId);

                // מיפוי ל-DTO (רק מה שצריך למנהל)
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
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }
    }
}