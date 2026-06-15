using System; // ספריית בסיס של C# — כוללת DateTime, Exception, Math ועוד
using System.Collections.Generic; // מאפשר שימוש ברשימות מסוג List<T>
using System.Linq; // מאפשר פעולות חיפוש, סינון, מיון וחישוב כמו Where, Any, FirstOrDefault, Average
using System.Threading.Tasks; // מאפשר שימוש ב-async / await / Task לעבודה אסינכרונית

using ManageR2.Infrastructure.Models.SmartAssignment; // שימוש במודלים של האלגוריתם
using ManageR2.Infrastructure.Repositories.SmartAssignment; // שימוש ב-Repository שמביא נתונים מה-DB

namespace ManageR2.Infrastructure.Services.SmartAssignment
{
    // English: advanced assignment—repository loads raw facts; this class scores, filters eligibility, ranks employees.
    // Service = שכבת הלוגיקה העסקית.
    // כאן מתבצע האלגוריתם עצמו:
    // חישוב ציונים, קביעת כשירות, מיון ודירוג עובדים.
    public class SmartAssignmentService : IAdvancedSmartAssignmentService
    {
        // Repository הוא האובייקט שמדבר עם ה-DB.
        // השירות לא פונה ישירות ל-SQL אלא מבקש מה-Repository להביא לו נתונים.
        private readonly SmartAssignmentRepository _repository;

        // Constructor = פעולה שרצה כשנוצר SmartAssignmentService.
        // היא מקבלת Repository ושומרת אותו במשתנה הפרטי _repository.
        public SmartAssignmentService(SmartAssignmentRepository repository)
        {
            _repository = repository; // שמירת ה-Repository לשימוש בהמשך
        }

        // הפונקציה הראשית של האלגוריתם.
        // קלט: workItemId = מזהה המשימה שעבורה רוצים לקבל המלצות.
        // פלט: רשימת עובדים עם ציונים, כשירות ודירוג.
        // English: orchestrates load → score → rank; controller maps EmployeeCandidateModel list to API DTOs.
        public async Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(int workItemId)
        {
            // מביאים מה-Repository את כל הנתונים שהאלגוריתם צריך.
            // בפועל ה-Repository מפעיל את ה-SP המאוחד Rec_GetTaskRecommendationInput.
            var input = await _repository.GetTaskRecommendationInputAsync(workItemId);

            // אם לא התקבלו נתונים, אין אפשרות להמשיך לחישוב.
            if (input == null)
                throw new Exception($"No data found for WorkItemId = {workItemId}");

            // מחשבים ציונים לכל עובד לפי הנתונים שהתקבלו, ממיינים ומדרגים.
            return RankCandidates(CalculateScores(input));
        }

        // English: same scoring engine, but for a not-yet-saved (draft) task built from the New Task form
        // context (project/date/duration/site) instead of an unrelated existing work item.
        // נקודת כניסה להמלצות עבור משימת טיוטה (משימה חדשה שעדיין לא נשמרה).
        public async Task<List<EmployeeCandidateModel>> GetRecommendationsForDraftAsync(
            DraftTaskRecommendationContextModel context)
        {
            var input = await _repository.GetDraftTaskRecommendationInputAsync(context);

            if (input == null)
                throw new Exception("No data found for draft recommendation context.");

            return RankCandidates(CalculateScores(input));
        }

        // מיון ודירוג: כשירים תחילה, ואז לפי ציון כולל יורד; קובע RankOrder.
        private List<EmployeeCandidateModel> RankCandidates(List<EmployeeCandidateModel> candidates)
        {
            var ranked = candidates
                .OrderByDescending(c => c.IsEligible)
                .ThenByDescending(c => c.TotalScore)
                .ToList();

            for (int i = 0; i < ranked.Count; i++)
            {
                ranked[i].RankOrder = i + 1;
            }

            return ranked;
        }

        // פונקציה זו מחשבת ציונים לכל העובדים.
        // היא לא פונה ל-DB, אלא עובדת רק על input שכבר הגיע מה-Repository.
        private List<EmployeeCandidateModel> CalculateScores(TaskRecommendationInputModel input)
        {
            // רשימת התוצאות הסופית.
            var result = new List<EmployeeCandidateModel>();

            // מעבר על כל עובד מועמד.
            foreach (var employee in input.Employees)
            {
                // חישוב ציון מקצועיות לפי תפקיד נדרש וכישורי העובד (משוקלל לפי חשיבות הכישור).
                var professional = CalculateProfessionalScore(input, employee);

                // חישוב זמינות.
                // אם העובד זמין לכל טווח המשימה — 100.
                // אם לא — null, כדי שבהצגה יופיע "לא זמין".
                var availabilityScore = CalculateAvailabilityScore(input, employee.EmployeeId);

                // חישוב ציון עומס עבודה לפי קיבולת ושיבוצים נוכחיים ביום המשימה.
                var workload = CalculateWorkload(input, employee);

                // קביעת מקור המוצא לחישוב הגיאוגרפי:
                // HomeBase / PlannedStop / LastKnownLocation / ManualOverride.
                var originType = DetermineOriginType(input, employee.EmployeeId);

                // חישוב ציון גיאוגרפי לפי מקור המוצא שנבחר וזמן הנסיעה.
                var geographicScore = CalculateGeographicScore(input, employee.EmployeeId, originType);

                // חישוב ציון ניסיון לפי שנות ניסיון ממוצעות בכישורי העובד.
                var experienceScore = CalculateExperienceScore(input, employee.EmployeeId);

                // חישוב ציון רציפות לפי שיבוצים קודמים מול אותו פרויקט / לקוח / אתר.
                var continuity = CalculateContinuity(input, employee.EmployeeId);

                // קביעת כשירות לבחירה בפועל.
                // עובד לא זמין יוצג בטבלה, אבל לא יהיה כשיר לבחירה.
                var eligibility = DetermineEligibility(employee, availabilityScore);

                // אם availabilityScore הוא null, כלומר לא זמין,
                // לצורך חישוב TotalScore נשתמש ב-0.
                // אבל בהצגה עדיין יוצג "לא זמין".
                var availabilityForTotal = availabilityScore ?? 0m;

                // חישוב ציון סופי משוקלל. המשקלים:
                // מקצועיות 30%, זמינות 15%, עומס 15%, גיאוגרפיה 15%, ניסיון 10%, רציפות 15%.
                var totalScore =
                    (professional.Score * 0.30m) +
                    (availabilityForTotal * 0.15m) +
                    (workload.Score * 0.15m) +
                    (geographicScore * 0.15m) +
                    (experienceScore * 0.10m) +
                    (continuity.Score * 0.15m);

                // הגנה: מוודאים שהציון הסופי נשאר בין 0 ל-100.
                totalScore = ClampScore(totalScore);

                // נתוני עזר להסבר (כמה כישורים תאמו/חסרו, פרטי נסיעה).
                var (matchedSkillsCount, missingSkillsCount) = CountSkillMatch(input, employee.EmployeeId);
                var routeDetail = GetRouteDetail(input, employee.EmployeeId, originType);

                // יצירת אובייקט עובד חדש עם כל הנתונים והציונים שחושבו.
                result.Add(new EmployeeCandidateModel
                {
                    EmployeeId = employee.EmployeeId, // מזהה עובד
                    FullName = employee.FullName, // שם מלא
                    PrimaryRole = employee.PrimaryRole, // תפקיד עיקרי
                    IsActive = employee.IsActive, // האם העובד פעיל
                    IsAssignable = employee.IsAssignable, // האם ניתן לשבץ את העובד
                    DailyCapacityHours = employee.DailyCapacityHours, // קיבולת יומית
                    Phone = employee.Phone, // טלפון
                    Email = employee.Email, // אימייל

                    ProfessionalScore = professional.Score, // ציון מקצועיות
                    AvailabilityScore = availabilityScore, // 100 אם זמין, null אם לא
                    WorkloadScore = workload.Score, // ציון עומס
                    GeographicScore = geographicScore, // ציון גיאוגרפי
                    ExperienceScore = experienceScore, // ציון ניסיון

                    // ציון רציפות: ניטרלי (50) כשאין היסטוריית שיבוצים, אחרת לפי חפיפה עם פרויקט/לקוח/אתר.
                    ContinuityScore = continuity.Score,

                    TotalScore = totalScore, // ציון סופי משוקלל

                    IsEligible = eligibility.IsEligible, // האם העובד כשיר לבחירה
                    ExclusionReason = eligibility.ExclusionReason, // סיבה אם לא כשיר

                    // הסבר מילולי למנהל.
                    RecommendationSummary = BuildSummary(
                        professional.Score,
                        availabilityScore,
                        workload.Score,
                        geographicScore,
                        experienceScore,
                        continuity.Score,
                        originType,
                        eligibility.IsEligible,
                        eligibility.ExclusionReason
                    ),

                    // אזהרות בפורמט JSON פשוט.
                    WarningsJson = BuildWarningsJson(
                        professional.Score,
                        availabilityScore,
                        workload.Score,
                        geographicScore,
                        eligibility.IsEligible,
                        eligibility.ExclusionReason
                    ),

                    // פרטי הסבר לשקיפות.
                    OriginTypeUsed = originType,
                    MatchedSkillsCount = matchedSkillsCount,
                    MissingSkillsCount = missingSkillsCount,
                    TravelMinutes = routeDetail.Minutes,
                    DistanceKm = routeDetail.DistanceKm,

                    // פרטי עומס ורציפות לשקיפות ולשמירה (Rec_TaskAssignmentRecommendations).
                    OpenAssignmentsCount = workload.Load?.OpenAssignmentsCount,
                    CurrentWorkloadHours = workload.Load?.CurrentAssignedHours,
                    WorkedWithCustomerBefore = continuity.Detail?.WorkedWithCustomerBefore,
                    WorkedAtSiteBefore = continuity.Detail?.WorkedAtSiteBefore,

                    // פירוט גורמים קריא להצגה למנהל (ציון, משקל, הסבר, מקור נתונים).
                    Factors = BuildFactors(
                        input,
                        employee,
                        professional,
                        availabilityScore,
                        workload,
                        geographicScore,
                        experienceScore,
                        continuity,
                        matchedSkillsCount,
                        missingSkillsCount,
                        originType,
                        routeDetail)
                });
            }

            // החזרת כל העובדים לאחר חישוב.
            return result;
        }

        // תוצאת ציון המקצועיות, כולל הנתונים ששימשו לחישוב (לצורך הסבר שקוף).
        private sealed class ProfessionalResult
        {
            public decimal Score { get; init; }
            public bool UsedSkills { get; init; }
            public bool UsedRole { get; init; }
            public decimal? RoleScore { get; init; }
        }

        // תוצאת ציון העומס, כולל מקורות הנתונים והעומס הנוכחי שנמצא.
        private sealed class WorkloadResult
        {
            public decimal Score { get; init; }
            public bool UsedCapacity { get; init; }
            public bool UsedCurrentLoad { get; init; }
            public decimal? DailyCapacityHours { get; init; }
            public decimal ProjectedHours { get; init; }
            public EmployeeCurrentLoadModel? Load { get; init; }
        }

        // תוצאת ציון הרציפות, כולל פירוט החפיפה (פרויקט/לקוח/אתר).
        private sealed class ContinuityResult
        {
            public decimal Score { get; init; }
            public bool HasData { get; init; }
            public EmployeeContinuityModel? Detail { get; init; }
        }

        // חישוב ציון מקצועיות.
        // משלב התאמת תפקיד נדרש מול התפקיד העיקרי של העובד, והתאמת כישורים משוקללת לפי חשיבות הכישור.
        // התוצאה מנורמלת ל-0 עד 100. כאשר אין דרישת תפקיד וגם אין דרישות כישורים — ציון ניטרלי (50).
        private ProfessionalResult CalculateProfessionalScore(TaskRecommendationInputModel input, EmployeeCandidateModel employee)
        {
            var requiredRole = input.Task?.RequiredRole;
            var hasRole = !string.IsNullOrWhiteSpace(requiredRole);
            var hasSkills = input.RequiredSkills != null && input.RequiredSkills.Count > 0;

            // אין כל אות ביקוש (לא תפקיד ולא כישורים) — אין בסיס להשוואה, ציון ניטרלי.
            if (!hasRole && !hasSkills)
                return new ProfessionalResult { Score = 50m, UsedSkills = false, UsedRole = false };

            decimal? skillScore = hasSkills ? CalculateSkillScore(input, employee.EmployeeId) : (decimal?)null;
            decimal? roleScore = hasRole ? CalculateRoleMatchScore(requiredRole!, employee.PrimaryRole) : (decimal?)null;

            // כאשר קיימים גם כישורים וגם תפקיד — הכישורים מובילים (80%) והתפקיד מתקף (20%).
            if (skillScore.HasValue && roleScore.HasValue)
            {
                return new ProfessionalResult
                {
                    Score = ClampScore(skillScore.Value * 0.8m + roleScore.Value * 0.2m),
                    UsedSkills = true,
                    UsedRole = true,
                    RoleScore = roleScore
                };
            }

            if (skillScore.HasValue)
                return new ProfessionalResult { Score = ClampScore(skillScore.Value), UsedSkills = true, UsedRole = false };

            // נשאר רק התפקיד (למשל משימת טיוטה ללא דרישות כישורים).
            return new ProfessionalResult { Score = ClampScore(roleScore!.Value), UsedSkills = false, UsedRole = true, RoleScore = roleScore };
        }

        // התאמת כישורים משוקללת לפי הרמה הנדרשת וחשיבות הכישור (Critical / Important / Preferred).
        private decimal CalculateSkillScore(TaskRecommendationInputModel input, int employeeId)
        {
            var employeeSkills = input.EmployeeSkills
                .Where(s => s.EmployeeId == employeeId)
                .ToList();

            decimal earnedPoints = 0;
            decimal maxPoints = 0;

            foreach (var requiredSkill in input.RequiredSkills)
            {
                // רמה נדרשת לכישור. אם לא תקינה, משתמשים ב-1 כדי למנוע חלוקה באפס.
                var requiredLevel = requiredSkill.RequiredLevel <= 0 ? 1 : requiredSkill.RequiredLevel;

                // משקל הכישור = רמה נדרשת * משקל חשיבות. כך כישור Critical משפיע יותר מ-Preferred.
                var skillWeight = requiredLevel * GetImportanceWeight(requiredSkill.ImportanceLevel);
                maxPoints += skillWeight;

                var employeeSkill = employeeSkills.FirstOrDefault(s => s.SkillId == requiredSkill.SkillId);
                if (employeeSkill == null)
                    continue;

                // יחס התאמה בין רמת העובד לרמה הנדרשת, חסום ב-100%.
                var levelRatio = Math.Min((decimal)employeeSkill.SkillLevel / requiredLevel, 1m);
                earnedPoints += skillWeight * levelRatio;
            }

            if (maxPoints <= 0)
                return 50m;

            return ClampScore((earnedPoints / maxPoints) * 100m);
        }

        // משקל חשיבות הכישור לפי הערכים המותרים ב-DB (Rec_WorkItemRequiredSkills.ImportanceLevel).
        private static decimal GetImportanceWeight(string? importanceLevel)
        {
            return importanceLevel switch
            {
                "Critical" => 2.0m,
                "Important" => 1.5m,
                "Preferred" => 0.75m,
                _ => 1.0m
            };
        }

        // התאמת התפקיד הנדרש מול התפקיד העיקרי של העובד. הנתונים משתמשים באותו אוצר מילים
        // (RequiredRole מיושר ל-PrimaryRole), ולכן התאמה מדויקת היא אות חזק.
        private static decimal CalculateRoleMatchScore(string requiredRole, string? primaryRole)
        {
            // אין לעובד תפקיד מוגדר — אי אפשר להשוות, ציון ניטרלי.
            if (string.IsNullOrWhiteSpace(primaryRole))
                return 50m;

            var required = requiredRole.Trim();
            var primary = primaryRole.Trim();

            if (string.Equals(required, primary, StringComparison.OrdinalIgnoreCase))
                return 100m;

            // התאמה חלקית (תפקיד אחד מכיל את השני) — התאמה סבירה.
            if (primary.Contains(required, StringComparison.OrdinalIgnoreCase) ||
                required.Contains(primary, StringComparison.OrdinalIgnoreCase))
                return 75m;

            // תפקיד שונה לחלוטין — התאמה נמוכה (אך לא פסילה).
            return 35m;
        }

        // חישוב זמינות בינארי.
        // 100 = זמין לכל המשימה.
        // null = לא זמין לכל המשימה.
        private decimal? CalculateAvailabilityScore(TaskRecommendationInputModel input, int employeeId)
        {
            return IsEmployeeFullyAvailable(input, employeeId)
                ? 100m
                : null;
        }

        // בדיקה האם העובד זמין לכל טווח המשימה.
        private bool IsEmployeeFullyAvailable(TaskRecommendationInputModel input, int employeeId)
        {
            // אם אין למשימה התחלה או סיום, אי אפשר לקבוע זמינות.
            if (input.Task?.PlannedStart == null || input.Task?.PlannedEnd == null)
                return false;

            // זמן התחלת המשימה.
            var taskStart = input.Task.PlannedStart.Value;

            // זמן סיום המשימה.
            var taskEnd = input.Task.PlannedEnd.Value;

            // כל רשומות הזמינות של העובד.
            var availabilityRows = input.EmployeeAvailability
                .Where(a => a.EmployeeId == employeeId)
                .ToList();

            // אם אין רשומות זמינות, העובד נחשב לא זמין.
            if (availabilityRows.Count == 0)
                return false;

            // בדיקה אם יש חסימה שחופפת למשימה:
            // חופש, מחלה, תפוס או הדרכה.
            var hasBlockingUnavailable = availabilityRows.Any(a =>
                IsTimeOverlapping(a.AvailableFrom, a.AvailableTo, taskStart, taskEnd) &&
                (
                    a.AvailabilityType == "Leave" ||
                    a.AvailabilityType == "Sick" ||
                    a.AvailabilityType == "Busy" ||
                    a.AvailabilityType == "Training"
                ));

            // אם יש חסימה, העובד לא זמין.
            if (hasBlockingUnavailable)
                return false;

            // בדיקה האם יש חלון Available שמכסה את כל המשימה.
            var hasFullAvailability = availabilityRows.Any(a =>
                a.AvailabilityType == "Available" &&
                a.AvailableFrom <= taskStart &&
                a.AvailableTo >= taskEnd);

            // true רק אם יש זמינות מלאה.
            return hasFullAvailability;
        }

        // חישוב ציון עומס עבודה.
        // מבוסס על קיבולת יומית של העובד מול השעות שכבר מחויבות באותו יום (שיבוצים קיימים) בתוספת
        // הערכת השעות של המשימה. כאשר אין נתוני קיבולת, נופלים לאות עומס לפי מספר השיבוצים הפתוחים.
        // כאשר אין כל נתוני עומס — ציון ניטרלי (50).
        private WorkloadResult CalculateWorkload(TaskRecommendationInputModel input, EmployeeCandidateModel employee)
        {
            var load = input.EmployeeCurrentLoads.FirstOrDefault(l => l.EmployeeId == employee.EmployeeId);
            var hasLoadData = input.EmployeeCurrentLoads.Count > 0;

            var dailyCapacity = ResolveDailyCapacityHours(input, employee);
            var hasCapacity = dailyCapacity is > 0;

            var currentHours = load?.CurrentAssignedHours ?? 0m;
            var taskHours = input.Task?.EstimatedHours ?? 0m;
            var projectedHours = currentHours + taskHours;

            // נתיב מועדף: ניצולת מול קיבולת יומית.
            if (hasCapacity)
            {
                var utilization = projectedHours / dailyCapacity!.Value;
                var score =
                    utilization <= 0.5m ? 100m :
                    utilization <= 0.75m ? 90m :
                    utilization <= 1.0m ? 75m :
                    utilization <= 1.25m ? 50m :
                    utilization <= 1.5m ? 30m : 15m;

                return new WorkloadResult
                {
                    Score = score,
                    UsedCapacity = true,
                    UsedCurrentLoad = hasLoadData,
                    DailyCapacityHours = dailyCapacity,
                    ProjectedHours = projectedHours,
                    Load = load
                };
            }

            // נתיב חלופי: אין קיבולת, אך יש נתוני שיבוצים — מדרגים לפי מספר השיבוצים הפתוחים.
            if (hasLoadData)
            {
                var openCount = load?.OpenAssignmentsCount ?? 0;
                var score =
                    openCount == 0 ? 90m :
                    openCount <= 2 ? 75m :
                    openCount <= 4 ? 55m : 35m;

                return new WorkloadResult
                {
                    Score = score,
                    UsedCapacity = false,
                    UsedCurrentLoad = true,
                    ProjectedHours = projectedHours,
                    Load = load
                };
            }

            // אין כל נתוני עומס — ציון ניטרלי.
            return new WorkloadResult { Score = 50m, UsedCapacity = false, UsedCurrentLoad = false, Load = load };
        }

        // קובע קיבולת יומית: קודם DailyCapacityHours של העובד, אחרת קיבולת שבועית חלקי 5.
        private decimal? ResolveDailyCapacityHours(TaskRecommendationInputModel input, EmployeeCandidateModel employee)
        {
            if (employee.DailyCapacityHours is > 0)
                return employee.DailyCapacityHours;

            var weekly = input.EmployeeCapacities.FirstOrDefault(c => c.EmployeeId == employee.EmployeeId);
            if (weekly != null && weekly.WeeklyCapacityHours > 0)
                return weekly.WeeklyCapacityHours / 5m;

            return null;
        }

        // חישוב ציון רציפות: האם העובד כבר עבד מול אותו פרויקט / לקוח / אתר.
        // כאשר אין כל היסטוריית שיבוצים לעובד — ציון ניטרלי (50) ומסומן כחסר נתונים.
        private ContinuityResult CalculateContinuity(TaskRecommendationInputModel input, int employeeId)
        {
            var continuity = input.EmployeeContinuities.FirstOrDefault(c => c.EmployeeId == employeeId);

            // אין נתוני רציפות בכלל (אין שיבוצים קודמים) — ניטרלי, לא מענישים ולא מתגמלים.
            if (continuity == null || continuity.TotalPriorAssignments == 0)
                return new ContinuityResult { Score = 50m, HasData = false, Detail = continuity };

            // יש היסטוריה — מדרגים לפי רמת החפיפה: אתר > לקוח > פרויקט > ללא חפיפה.
            decimal score =
                continuity.WorkedAtSiteBefore ? 100m :
                continuity.WorkedWithCustomerBefore ? 85m :
                continuity.WorkedOnProjectBefore ? 75m : 40m;

            return new ContinuityResult { Score = score, HasData = true, Detail = continuity };
        }

        // קביעת מקור המוצא של העובד.
        private string DetermineOriginType(TaskRecommendationInputModel input, int employeeId)
        {
            // אם המשבץ הזין כתובת מוצא ידנית, היא מקבלת עדיפות ראשונה.
            if (input.Task?.HasManualOriginOverride == true)
                return "ManualOverride";

            // אם המשימה היא מהיום להיום, ננסה להשתמש במיקום דינמי.
            if (IsCriticalSameDayTask(input))
            {
                // תחנה מתוכננת רלוונטית:
                // תחנה של העובד שמסתיימת לפני תחילת המשימה.
                var hasRelevantPlannedStop = input.PlannedStops.Any(p =>
                    p.EmployeeId == employeeId &&
                    p.PlannedEndAt.HasValue &&
                    input.Task?.PlannedStart.HasValue == true &&
                    p.PlannedEndAt.Value <= input.Task.PlannedStart.Value);

                // אם יש תחנה מתוכננת לפני המשימה, נשתמש בה כמוצא.
                if (hasRelevantPlannedStop)
                    return "PlannedStop";

                // אם אין תחנה מתוכננת אבל יש אירוע מיקום, נשתמש במיקום האחרון.
                var hasLocationEvent = input.LocationEvents.Any(e =>
                    e.EmployeeId == employeeId);

                if (hasLocationEvent)
                    return "LastKnownLocation";
            }

            // ברירת מחדל: כתובת בסיס של העובד.
            return "HomeBase";
        }

        // בדיקה האם המשימה היא קריטית מהיום להיום.
        private bool IsCriticalSameDayTask(TaskRecommendationInputModel input)
        {
            // אם אין תאריך התחלה, לא ניתן לקבוע שהיא מהיום.
            if (input.Task?.PlannedStart == null)
                return false;

            // תאריך המשימה בלבד, בלי שעה.
            var taskDate = input.Task.PlannedStart.Value.Date;

            // התאריך של היום לפי זמן השרת.
            var today = DateTime.Today;

            // אם תאריך המשימה שווה להיום, היא נחשבת קריטית מהיום להיום.
            return taskDate == today;
        }

        // חישוב ציון גיאוגרפי לפי זמן נסיעה.
        private decimal CalculateGeographicScore(TaskRecommendationInputModel input, int employeeId, string originType)
        {
            // מזהה אתר המשימה, אם קיים.
            var targetSiteId = input.Task?.SiteId;

            // ניסיון למצוא Route שמתאים גם לעובד, גם לאתר, וגם לסוג המוצא.
            var route = input.RouteEstimates.FirstOrDefault(r =>
                r.EmployeeId == employeeId &&
                r.OriginType == originType &&
                (!targetSiteId.HasValue || r.TargetSiteId == targetSiteId.Value));

            // אם לא נמצא Route למוצא המדויק, ננסה למצוא Route כללי לעובד ולאתר.
            if (route == null)
            {
                route = input.RouteEstimates.FirstOrDefault(r =>
                    r.EmployeeId == employeeId &&
                    (!targetSiteId.HasValue || r.TargetSiteId == targetSiteId.Value));
            }

            // אם אין נתון נסיעה, מחזירים ציון ניטרלי.
            if (route == null || route.EstimatedTravelMinutes == null)
                return 50;

            // זמן הנסיעה בדקות.
            var minutes = route.EstimatedTravelMinutes.Value;

            // מדרגות ניקוד לפי זמן נסיעה.
            if (minutes <= 15)
                return 100;

            if (minutes <= 30)
                return 90;

            if (minutes <= 45)
                return 75;

            if (minutes <= 60)
                return 60;

            if (minutes <= 90)
                return 35;

            // מעל 90 דקות — ציון נמוך אך לא פסילה.
            return 15;
        }

        // חישוב ציון ניסיון.
        private decimal CalculateExperienceScore(TaskRecommendationInputModel input, int employeeId)
        {
            // כל כישורי העובד.
            var employeeSkills = input.EmployeeSkills
                .Where(s => s.EmployeeId == employeeId)
                .ToList();

            // אם אין מידע על כישורים, מחזירים ציון ניסיון נמוך-בינוני.
            if (employeeSkills.Count == 0)
                return 40;

            // ממוצע שנות ניסיון של העובד מתוך הכישורים שלו.
            var avgYears = employeeSkills
                .Where(s => s.YearsExperience.HasValue)
                .Select(s => s.YearsExperience!.Value)
                .DefaultIfEmpty(0)
                .Average();

            // מדרגות ניסיון.
            if (avgYears >= 8)
                return 100;

            if (avgYears >= 5)
                return 85;

            if (avgYears >= 3)
                return 70;

            if (avgYears >= 1)
                return 50;

            return 30;
        }

        // קביעת כשירות לבחירה בפועל.
        private (bool IsEligible, string? ExclusionReason) DetermineEligibility(
            EmployeeCandidateModel employee,
            decimal? availabilityScore)
        {
            // עובד לא פעיל לא יכול להיבחר.
            if (!employee.IsActive)
                return (false, "עובד לא פעיל");

            // עובד שלא ניתן לשיבוץ לא יכול להיבחר.
            if (!employee.IsAssignable)
                return (false, "עובד לא ניתן לשיבוץ");

            // אם אין זמינות מלאה, העובד לא כשיר לבחירה.
            if (!availabilityScore.HasValue)
                return (false, "לא זמין");

            // אחרת העובד כשיר.
            return (true, null);
        }

        // בדיקת חפיפה בין שני טווחי זמן.
        private bool IsTimeOverlapping(DateTime start1, DateTime end1, DateTime start2, DateTime end2)
        {
            // חפיפה קיימת אם תחילת הטווח הראשון לפני סוף השני
            // וגם סוף הטווח הראשון אחרי תחילת השני.
            return start1 < end2 && end1 > start2;
        }

        // מגביל ציון לטווח 0 עד 100.
        private decimal ClampScore(decimal score)
        {
            if (score < 0)
                return 0;

            if (score > 100)
                return 100;

            return score;
        }

        // בניית הסבר מילולי למנהל.
        private string BuildSummary(
            decimal professional,
            decimal? availability,
            decimal workload,
            decimal geographic,
            decimal experience,
            decimal continuity,
            string originType,
            bool isEligible,
            string? exclusionReason)
        {
            // אם יש ציון זמינות, מציגים אותו; אחרת מציגים "לא זמין".
            var availabilityText = availability.HasValue
                ? availability.Value.ToString("0.##")
                : "לא זמין";

            // טקסט כשירות.
            var eligibilityText = isEligible
                ? "כשיר לבחירה"
                : $"לא כשיר לבחירה: {exclusionReason}";

            // החזרת סיכום מלא.
            return
                $"{eligibilityText}. " +
                $"מקצועיות: {professional:0.##}, " +
                $"זמינות: {availabilityText}, " +
                $"עומס: {workload:0.##}, " +
                $"גיאוגרפיה: {geographic:0.##}, " +
                $"ניסיון: {experience:0.##}, " +
                $"רציפות: {continuity:0.##}, " +
                $"מקור מוצא: {originType}";
        }

        // בניית JSON פשוט של אזהרות.
        private string BuildWarningsJson(
            decimal professional,
            decimal? availability,
            decimal workload,
            decimal geographic,
            bool isEligible,
            string? exclusionReason)
        {
            // רשימת אזהרות.
            var warnings = new List<string>();

            // אם העובד לא כשיר, מוסיפים את הסיבה.
            if (!isEligible && !string.IsNullOrWhiteSpace(exclusionReason))
                warnings.Add(exclusionReason);

            if (professional < 50)
                warnings.Add("התאמה מקצועית נמוכה");

            if (!availability.HasValue)
                warnings.Add("לא זמין");

            if (workload < 50)
                warnings.Add("עומס עבודה גבוה");

            if (geographic < 50)
                warnings.Add("מרחק או זמן נסיעה גבוה");

            if (warnings.Count == 0)
                return "[]";

            // JSON פשוט: ["אזהרה 1","אזהרה 2"]
            return "[\"" + string.Join("\",\"", warnings) + "\"]";
        }

        // ספירת כישורים תואמים/חסרים בין דרישות המשימה לכישורי העובד (לצורך הסבר).
        private (int Matched, int Missing) CountSkillMatch(TaskRecommendationInputModel input, int employeeId)
        {
            if (input.RequiredSkills == null || input.RequiredSkills.Count == 0)
                return (0, 0);

            var employeeSkillIds = input.EmployeeSkills
                .Where(s => s.EmployeeId == employeeId)
                .Select(s => s.SkillId)
                .ToHashSet();

            var matched = input.RequiredSkills.Count(r => employeeSkillIds.Contains(r.SkillId));
            var missing = input.RequiredSkills.Count - matched;
            return (matched, missing);
        }

        // איתור פרטי נסיעה (דקות/ק"מ) למוצא שנבחר, אם קיימים נתוני Route.
        private (int? Minutes, decimal? DistanceKm, bool HasRoute) GetRouteDetail(
            TaskRecommendationInputModel input,
            int employeeId,
            string originType)
        {
            var targetSiteId = input.Task?.SiteId;

            var route = input.RouteEstimates.FirstOrDefault(r =>
                r.EmployeeId == employeeId &&
                r.OriginType == originType &&
                (!targetSiteId.HasValue || r.TargetSiteId == targetSiteId.Value))
                ?? input.RouteEstimates.FirstOrDefault(r =>
                r.EmployeeId == employeeId &&
                (!targetSiteId.HasValue || r.TargetSiteId == targetSiteId.Value));

            if (route == null)
                return (null, null, false);

            return (route.EstimatedTravelMinutes, route.EstimatedDistanceKm, true);
        }

        // בניית פירוט הגורמים: לכל גורם — ציון, משקל, הסבר קריא, מקור הנתונים, והאם היו נתונים.
        // English: builds the per-factor explanation list (score/weight/explanation/data source/has-data).
        private List<RecommendationFactorModel> BuildFactors(
            TaskRecommendationInputModel input,
            EmployeeCandidateModel employee,
            ProfessionalResult professional,
            decimal? availability,
            WorkloadResult workload,
            decimal geographic,
            decimal experience,
            ContinuityResult continuity,
            int matchedSkills,
            int missingSkills,
            string originType,
            (int? Minutes, decimal? DistanceKm, bool HasRoute) routeDetail)
        {
            var factors = new List<RecommendationFactorModel>();

            // 1) התאמה מקצועית (30%) — תפקיד נדרש + כישורי המשימה מול העובד (משוקלל לפי חשיבות).
            var requiredRole = input.Task?.RequiredRole;
            factors.Add(new RecommendationFactorModel
            {
                Key = "professional",
                Label = "התאמה מקצועית",
                Score = professional.Score,
                WeightPercent = 30m,
                HasData = professional.UsedSkills || professional.UsedRole,
                DataSource = BuildProfessionalDataSource(professional),
                Explanation = BuildProfessionalExplanation(professional, requiredRole, employee.PrimaryRole, matchedSkills, missingSkills)
            });

            // 2) זמינות (15%) — יומן הזמינות של העובד מול חלון הזמן של המשימה.
            factors.Add(new RecommendationFactorModel
            {
                Key = "availability",
                Label = "זמינות",
                Score = availability,
                WeightPercent = 15m,
                HasData = availability.HasValue,
                DataSource = "יומן זמינות העובד (Rec_EmployeeAvailability) מול חלון הזמן המתוכנן של המשימה",
                Explanation = availability.HasValue
                    ? "העובד זמין לכל חלון הזמן של המשימה."
                    : "אין חלון זמינות מלא תואם — העובד מסומן כלא זמין ואינו כשיר לבחירה."
            });

            // 3) עומס עבודה (15%) — קיבולת יומית מול שעות שכבר מחויבות ביום המשימה.
            factors.Add(new RecommendationFactorModel
            {
                Key = "workload",
                Label = "עומס עבודה",
                Score = workload.Score,
                WeightPercent = 15m,
                HasData = workload.UsedCapacity || workload.UsedCurrentLoad,
                DataSource = BuildWorkloadDataSource(workload),
                Explanation = BuildWorkloadExplanation(workload)
            });

            // 4) גיאוגרפיה (15%) — הערכת זמן נסיעה מהמוצא שנבחר אל אתר המשימה.
            var travelText = routeDetail.HasRoute && routeDetail.Minutes.HasValue
                ? $"זמן נסיעה משוער: {routeDetail.Minutes} דקות (מקור מוצא: {originType})."
                : $"אין נתוני נסיעה זמינים (מקור מוצא: {originType}) — נעשה שימוש בציון ניטרלי (50).";
            factors.Add(new RecommendationFactorModel
            {
                Key = "geographic",
                Label = "מרחק / נסיעה",
                Score = geographic,
                WeightPercent = 15m,
                HasData = routeDetail.HasRoute,
                DataSource = "הערכות נסיעה (Rec_RouteEstimates) מהמוצא של העובד אל אתר המשימה",
                Explanation = travelText
            });

            // 5) ניסיון (10%) — שנות ניסיון ממוצעות בכישורי העובד.
            var hasSkillData = input.EmployeeSkills != null &&
                input.EmployeeSkills.Any(s => s.EmployeeId == employee.EmployeeId);
            factors.Add(new RecommendationFactorModel
            {
                Key = "experience",
                Label = "ניסיון",
                Score = experience,
                WeightPercent = 10m,
                HasData = hasSkillData,
                DataSource = "שנות הניסיון בכישורי העובד (Rec_EmployeeSkills)",
                Explanation = hasSkillData
                    ? "מבוסס על ממוצע שנות הניסיון בכישורי העובד."
                    : "אין נתוני כישורים לעובד — נעשה שימוש בציון ניסיון נמוך-בינוני (40)."
            });

            // 6) רציפות (15%) — האם העובד כבר עבד מול אותו פרויקט / לקוח / אתר.
            factors.Add(new RecommendationFactorModel
            {
                Key = "continuity",
                Label = "רציפות (היכרות עם הפרויקט/הלקוח)",
                Score = continuity.Score,
                WeightPercent = 15m,
                HasData = continuity.HasData,
                DataSource = "שיבוצים קודמים (WorkEmployeeAssignments) מול הפרויקט / הלקוח / האתר של המשימה",
                Explanation = BuildContinuityExplanation(continuity)
            });

            return factors;
        }

        // מקור הנתונים של גורם המקצועיות, לפי מה ששימש בפועל (תפקיד / כישורים).
        private static string BuildProfessionalDataSource(ProfessionalResult professional)
        {
            if (professional.UsedSkills && professional.UsedRole)
                return "דרישות הכישורים של המשימה (Rec_WorkItemRequiredSkills) + התפקיד הנדרש מול תפקיד העובד";
            if (professional.UsedSkills)
                return "דרישות הכישורים של המשימה (Rec_WorkItemRequiredSkills) מול כישורי העובד";
            if (professional.UsedRole)
                return "התפקיד הנדרש של המשימה (WorkItems.RequiredRole) מול התפקיד העיקרי של העובד";
            return "אין דרישות תפקיד או כישורים למשימה";
        }

        // הסבר קריא לגורם המקצועיות, כולל ציון התאמת תפקיד והתאמת כישורים כשרלוונטי.
        private static string BuildProfessionalExplanation(
            ProfessionalResult professional,
            string? requiredRole,
            string? primaryRole,
            int matchedSkills,
            int missingSkills)
        {
            if (!professional.UsedSkills && !professional.UsedRole)
                return "למשימה אין דרישת תפקיד או כישורים — ציון מקצועי ניטרלי (50).";

            var parts = new List<string>();

            if (professional.UsedSkills)
                parts.Add($"{matchedSkills} מתוך {matchedSkills + missingSkills} כישורים נדרשים תואמים (משוקלל לפי חשיבות הכישור).");

            if (professional.UsedRole)
            {
                var roleScore = professional.RoleScore ?? 0m;
                var roleText =
                    string.IsNullOrWhiteSpace(primaryRole) ? "לעובד אין תפקיד מוגדר — התאמת תפקיד ניטרלית." :
                    roleScore >= 100m ? $"תפקיד העובד ({primaryRole}) תואם במדויק לתפקיד הנדרש ({requiredRole})." :
                    roleScore >= 75m ? $"תפקיד העובד ({primaryRole}) תואם חלקית לתפקיד הנדרש ({requiredRole})." :
                    $"תפקיד העובד ({primaryRole}) שונה מהתפקיד הנדרש ({requiredRole}).";
                parts.Add(roleText);
            }

            return string.Join(" ", parts);
        }

        // מקור הנתונים של גורם העומס, לפי מה ששימש בפועל (קיבולת / שיבוצים).
        private static string BuildWorkloadDataSource(WorkloadResult workload)
        {
            if (workload.UsedCapacity)
                return "קיבולת יומית של העובד מול שעות מחויבות ביום המשימה (WorkEmployeeAssignments + WorkItems.EstimatedHours)";
            if (workload.UsedCurrentLoad)
                return "מספר השיבוצים הפתוחים של העובד ביום המשימה (WorkEmployeeAssignments)";
            return "אין נתוני קיבולת או שיבוצים נוכחיים";
        }

        // הסבר קריא לגורם העומס, כולל השעות והקיבולת ששימשו.
        private static string BuildWorkloadExplanation(WorkloadResult workload)
        {
            if (workload.UsedCapacity)
            {
                var capacity = workload.DailyCapacityHours ?? 0m;
                var current = workload.Load?.CurrentAssignedHours ?? 0m;
                return $"שעות מתוכננות ליום: {workload.ProjectedHours:0.##} מתוך קיבולת {capacity:0.##} " +
                       $"(כולל {current:0.##} שעות שכבר מחויבות באותו יום).";
            }

            if (workload.UsedCurrentLoad)
            {
                var openCount = workload.Load?.OpenAssignmentsCount ?? 0;
                return $"אין נתוני קיבולת — ההערכה מבוססת על {openCount} שיבוצים פתוחים ביום המשימה.";
            }

            return "אין נתוני קיבולת או שיבוצים נוכחיים — נעשה שימוש בציון ניטרלי (50).";
        }

        // הסבר קריא לגורם הרציפות, לפי רמת ההיכרות עם הפרויקט / הלקוח / האתר.
        private static string BuildContinuityExplanation(ContinuityResult continuity)
        {
            if (!continuity.HasData || continuity.Detail == null)
                return "אין היסטוריית שיבוצים קודמת לעובד — ציון רציפות ניטרלי (50).";

            var detail = continuity.Detail;
            if (detail.WorkedAtSiteBefore)
                return "העובד כבר עבד באתר זה בעבר — היכרות גבוהה עם המיקום.";
            if (detail.WorkedWithCustomerBefore)
                return "העובד כבר עבד עם לקוח זה בעבר — היכרות עם הלקוח.";
            if (detail.WorkedOnProjectBefore)
                return "העובד כבר שובץ למשימות בפרויקט זה בעבר — רציפות בפרויקט.";

            return $"לעובד {detail.TotalPriorAssignments} שיבוצים קודמים, אך לא מול פרויקט / לקוח / אתר זה.";
        }
    }
}