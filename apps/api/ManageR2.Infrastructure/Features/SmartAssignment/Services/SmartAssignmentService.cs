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
                // חישוב ציון מקצועיות לפי התאמת כישורי העובד לדרישות המשימה.
                var professionalScore = CalculateProfessionalScore(input, employee.EmployeeId);

                // חישוב זמינות.
                // אם העובד זמין לכל טווח המשימה — 100.
                // אם לא — null, כדי שבהצגה יופיע "לא זמין".
                var availabilityScore = CalculateAvailabilityScore(input, employee.EmployeeId);

                // חישוב ציון עומס עבודה.
                var workloadScore = CalculateWorkloadScore(input, employee.EmployeeId);

                // קביעת מקור המוצא לחישוב הגיאוגרפי:
                // HomeBase / PlannedStop / LastKnownLocation / ManualOverride.
                var originType = DetermineOriginType(input, employee.EmployeeId);

                // חישוב ציון גיאוגרפי לפי מקור המוצא שנבחר וזמן הנסיעה.
                var geographicScore = CalculateGeographicScore(input, employee.EmployeeId, originType);

                // חישוב ציון ניסיון לפי שנות ניסיון ממוצעות בכישורי העובד.
                var experienceScore = CalculateExperienceScore(input, employee.EmployeeId);

                // קביעת כשירות לבחירה בפועל.
                // עובד לא זמין יוצג בטבלה, אבל לא יהיה כשיר לבחירה.
                var eligibility = DetermineEligibility(employee, availabilityScore);

                // אם availabilityScore הוא null, כלומר לא זמין,
                // לצורך חישוב TotalScore נשתמש ב-0.
                // אבל בהצגה עדיין יוצג "לא זמין".
                var availabilityForTotal = availabilityScore ?? 0m;

                // חישוב ציון סופי ללא ContinuityScore.
                // המשקלים:
                // מקצועיות 35%, זמינות 25%, עומס 15%, גיאוגרפיה 15%, ניסיון 10%.
                var totalScore =
                    (professionalScore * 0.35m) +
                    (availabilityForTotal * 0.25m) +
                    (workloadScore * 0.15m) +
                    (geographicScore * 0.15m) +
                    (experienceScore * 0.10m);

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

                    ProfessionalScore = professionalScore, // ציון מקצועיות
                    AvailabilityScore = availabilityScore, // 100 אם זמין, null אם לא
                    WorkloadScore = workloadScore, // ציון עומס
                    GeographicScore = geographicScore, // ציון גיאוגרפי
                    ExperienceScore = experienceScore, // ציון ניסיון

                    // ContinuityScore הוסר מהחישוב בשלב הנוכחי.
                    ContinuityScore = null,

                    TotalScore = totalScore, // ציון סופי משוקלל

                    IsEligible = eligibility.IsEligible, // האם העובד כשיר לבחירה
                    ExclusionReason = eligibility.ExclusionReason, // סיבה אם לא כשיר

                    // הסבר מילולי למנהל.
                    RecommendationSummary = BuildSummary(
                        professionalScore,
                        availabilityScore,
                        workloadScore,
                        geographicScore,
                        experienceScore,
                        originType,
                        eligibility.IsEligible,
                        eligibility.ExclusionReason
                    ),

                    // אזהרות בפורמט JSON פשוט.
                    WarningsJson = BuildWarningsJson(
                        professionalScore,
                        availabilityScore,
                        workloadScore,
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

                    // פירוט גורמים קריא להצגה למנהל (ציון, משקל, הסבר, מקור נתונים).
                    Factors = BuildFactors(
                        input,
                        professionalScore,
                        availabilityScore,
                        workloadScore,
                        geographicScore,
                        experienceScore,
                        matchedSkillsCount,
                        missingSkillsCount,
                        originType,
                        routeDetail)
                });
            }

            // החזרת כל העובדים לאחר חישוב.
            return result;
        }

        // חישוב ציון מקצועיות.
        // משתמש רק ב-RequiredLevel ולא ב-ImportanceLevel.
        // התוצאה מנורמלת ל-0 עד 100.
        private decimal CalculateProfessionalScore(TaskRecommendationInputModel input, int employeeId)
        {
            // אם למשימה אין דרישות כישורים, אין בסיס להשוואה.
            // מחזירים 50 כציון ניטרלי.
            if (input.RequiredSkills == null || input.RequiredSkills.Count == 0)
                return 50;

            // שליפת כל כישורי העובד הנוכחי.
            var employeeSkills = input.EmployeeSkills
                .Where(s => s.EmployeeId == employeeId)
                .ToList();

            // נקודות שהעובד צבר בפועל.
            decimal earnedPoints = 0;

            // סך הנקודות המקסימלי האפשרי לפי דרישות המשימה.
            decimal maxPoints = 0;

            // מעבר על כל כישור שהמשימה דורשת.
            foreach (var requiredSkill in input.RequiredSkills)
            {
                // רמה נדרשת לכישור.
                // אם הרמה לא תקינה, משתמשים ב-1 כדי למנוע חלוקה באפס.
                var requiredLevel = requiredSkill.RequiredLevel <= 0
                    ? 1
                    : requiredSkill.RequiredLevel;

                // הרמה הנדרשת עצמה משמשת כמשקל הכישור.
                // לדוגמה: RequiredLevel=4 משפיע יותר מ-RequiredLevel=2.
                maxPoints += requiredLevel;

                // מחפשים אם לעובד יש את הכישור הנדרש.
                var employeeSkill = employeeSkills
                    .FirstOrDefault(s => s.SkillId == requiredSkill.SkillId);

                // אם אין לעובד את הכישור, הוא מקבל 0 עבור הכישור הזה.
                if (employeeSkill == null)
                    continue;

                // יחס התאמה בין רמת העובד לרמה הנדרשת.
                // לדוגמה: עובד רמה 3 מול דרישה 4 = 0.75.
                var levelRatio = (decimal)employeeSkill.SkillLevel / requiredLevel;

                // אם העובד מעל הרמה הנדרשת, לא נותנים יותר מ-100% עבור אותו כישור.
                levelRatio = Math.Min(levelRatio, 1m);

                // הנקודות בפועל עבור הכישור.
                earnedPoints += requiredLevel * levelRatio;
            }

            // אם אין מקסימום תקין, מחזירים ציון ניטרלי.
            if (maxPoints <= 0)
                return 50;

            // נרמול ל-0 עד 100:
            // נקודות בפועל חלקי נקודות מקסימום כפול 100.
            var score = (earnedPoints / maxPoints) * 100m;

            // הגבלת הציון ל-0 עד 100.
            return ClampScore(score);
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
        // כרגע חישוב ראשוני: אם קיימת קיבולת — 80, אחרת 50.
        private decimal CalculateWorkloadScore(TaskRecommendationInputModel input, int employeeId)
        {
            // מחפשים קיבולת לעובד.
            var capacity = input.EmployeeCapacities
                .FirstOrDefault(c => c.EmployeeId == employeeId);

            // אם אין קיבולת, מחזירים ציון ניטרלי.
            if (capacity == null)
                return 50;

            // אם יש קיבולת, מניחים שהעובד מוגדר לתכנון.
            return 80;
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
            decimal professional,
            decimal? availability,
            decimal workload,
            decimal geographic,
            decimal experience,
            int matchedSkills,
            int missingSkills,
            string originType,
            (int? Minutes, decimal? DistanceKm, bool HasRoute) routeDetail)
        {
            var factors = new List<RecommendationFactorModel>();

            // 1) התאמה מקצועית (35%) — דרישות כישורי המשימה מול כישורי העובד.
            var hasSkillRequirements = input.RequiredSkills != null && input.RequiredSkills.Count > 0;
            factors.Add(new RecommendationFactorModel
            {
                Key = "professional",
                Label = "התאמה מקצועית",
                Score = professional,
                WeightPercent = 35m,
                HasData = hasSkillRequirements,
                DataSource = "כישורי העובד מול דרישות הכישורים של המשימה",
                Explanation = hasSkillRequirements
                    ? $"{matchedSkills} מתוך {matchedSkills + missingSkills} כישורים נדרשים תואמים."
                    : "למשימה אין דרישות כישורים מוגדרות — ציון מקצועי ניטרלי (50)."
            });

            // 2) זמינות (25%) — יומן הזמינות של העובד מול חלון הזמן של המשימה.
            factors.Add(new RecommendationFactorModel
            {
                Key = "availability",
                Label = "זמינות",
                Score = availability,
                WeightPercent = 25m,
                HasData = availability.HasValue,
                DataSource = "יומן זמינות העובד מול חלון הזמן המתוכנן של המשימה",
                Explanation = availability.HasValue
                    ? "העובד זמין לכל חלון הזמן של המשימה."
                    : "אין חלון זמינות מלא תואם — העובד מסומן כלא זמין ואינו כשיר לבחירה."
            });

            // 3) עומס עבודה (15%) — הגדרת קיבולת העובד.
            var hasCapacity = input.EmployeeCapacities != null && input.EmployeeCapacities.Count > 0;
            factors.Add(new RecommendationFactorModel
            {
                Key = "workload",
                Label = "עומס עבודה",
                Score = workload,
                WeightPercent = 15m,
                HasData = hasCapacity,
                DataSource = "הגדרת קיבולת העובד (Rec_EmployeeCapacity)",
                Explanation = hasCapacity
                    ? "לעובד מוגדרת קיבולת לתכנון."
                    : "אין נתוני קיבולת — נעשה שימוש בציון ניטרלי (50)."
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
            var hasSkillData = input.EmployeeSkills != null && input.EmployeeSkills.Count > 0;
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

            return factors;
        }
    }
}