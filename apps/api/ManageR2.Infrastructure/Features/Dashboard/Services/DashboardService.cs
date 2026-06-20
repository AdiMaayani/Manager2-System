using System.Globalization;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Models;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Services;

// Orchestrates the dashboard command center. It decides — purely from the caller's roles — which focused
// queries to run, then composes a small, prioritized, de-duplicated payload. It never returns data the
// caller is not permitted to see, and never surfaces secret values or sensitive audit metadata.
public class DashboardService : IDashboardService
{
    private const int MaxRecommendations = 7;
    private const int MaxWarnings = 7;
    private const int MaxPersonalTasks = 6;
    private const int MaxRecentActivity = 8;
    private const int MaxKpis = 4;
    private const int QuoteFollowUpStaleDays = 7;

    // Project-manager assignment roles, matched exactly as in sp_GetProjectsList / the dashboard SPs.
    private const string SeverityCritical = "critical";
    private const string SeverityAttention = "attention";
    private const string SeverityInfo = "info";

    private readonly IDashboardRepository _dashboardRepository;
    private readonly IInventoryItemRepository _inventoryItemRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(
        IDashboardRepository dashboardRepository,
        IInventoryItemRepository inventoryItemRepository,
        IAuditLogService auditLogService,
        ILogger<DashboardService> logger)
    {
        _dashboardRepository = dashboardRepository;
        _inventoryItemRepository = inventoryItemRepository;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<DashboardModel> GetDashboardAsync(DashboardContext context)
    {
        var roles = new RoleSet(context.Roles);
        var employeeId = context.EmployeeId is > 0 ? context.EmployeeId.Value : 0;
        var today = DateTime.Today;

        // --- Fetch only the data the caller's roles permit -----------------------------------------
        var personalTasks = employeeId > 0
            ? await _dashboardRepository.GetPersonalTasksAsync(employeeId)
            : new List<DashboardPersonalTaskRow>();

        var serviceCalls = roles.CanViewServiceCalls
            ? await _dashboardRepository.GetServiceCallExceptionsAsync(
                employeeId > 0 ? employeeId : null,
                includeOrgWide: roles.CanSeeOrgServiceCalls)
            : new List<DashboardServiceCallRow>();

        var projects = roles.CanViewProjects
            ? await _dashboardRepository.GetProjectsNeedingAttentionAsync(
                employeeId > 0 ? employeeId : null,
                onlyManaged: roles.IsProjectManager && !roles.IsManagement)
            : new List<DashboardProjectAttentionRow>();

        var quotes = roles.CanViewQuotes
            ? await _dashboardRepository.GetQuotesNeedingFollowUpAsync(QuoteFollowUpStaleDays)
            : new List<DashboardQuoteFollowUpRow>();

        var customerGaps = roles.CanSeeCustomerCompleteness
            ? await _dashboardRepository.GetCustomersMissingContactInfoAsync()
            : new List<DashboardCustomerContactGapRow>();

        var draftReports = roles.CanViewReports && employeeId > 0
            ? await _dashboardRepository.GetMyDraftReportsAsync(employeeId)
            : new List<DashboardDraftReportRow>();

        var lowStock = roles.CanViewInventory
            ? (await _inventoryItemRepository.GetListAsync(null, null, "active", lowStockOnly: true)).ToList()
            : new List<InventoryItem>();

        // --- Personal tasks: classify against "today" (server-local, matches the SP date logic) -----
        var personalTasksToday = personalTasks
            .Where(task => IsToday(task.PlannedStart, today))
            .OrderBy(task => task.PlannedStart ?? task.PlannedEnd ?? DateTime.MaxValue)
            .Take(MaxPersonalTasks)
            .Select(task => new DashboardTaskModel
            {
                WorkItemId = task.WorkItemId,
                Title = task.Title,
                Status = task.Status,
                PlannedStart = task.PlannedStart,
                PlannedEnd = task.PlannedEnd,
                ProjectTitle = task.ProjectTitle,
                CustomerName = task.CustomerName,
                SiteName = task.SiteName,
                // Open WorkPlan on the task's own day (its plannedStart, matching WorkPlan daily placement)
                // and deep-link the exact WorkItem so its details drawer opens automatically.
                ActionRoute = BuildPersonalWorkPlanRoute(task.PlannedStart, task.WorkItemId, today),
            })
            .ToList();

        var overduePersonalTasks = personalTasks
            .Where(task => task.PlannedEnd.HasValue && task.PlannedEnd.Value.Date < today)
            .OrderBy(task => task.PlannedEnd)
            .ToList();

        // --- Recommendations (actions to take) ------------------------------------------------------
        var recommendations = BuildRecommendations(serviceCalls, projects, quotes, customerGaps, draftReports, lowStock, roles, today);

        // Projects already surfaced as a "no project manager" recommendation are not repeated as warnings.
        var projectsUsedInRecommendations = recommendations
            .Where(r => string.Equals(r.EntityType, "Project", StringComparison.OrdinalIgnoreCase) && r.EntityId.HasValue)
            .Select(r => r.EntityId!.Value)
            .ToHashSet();

        // --- Early warnings (something is already abnormal) -----------------------------------------
        var warnings = BuildWarnings(overduePersonalTasks, projects, quotes, projectsUsedInRecommendations, roles, today);

        // --- KPIs (role-aware, max four) ------------------------------------------------------------
        var kpis = BuildKpis(roles, personalTasksToday.Count, overduePersonalTasks.Count, serviceCalls, projects.Count,
            quotes.Count, customerGaps.Count, draftReports.Count, lowStock.Count, today);

        // --- Recent activity (reuses the audit trail, sanitized) ------------------------------------
        var recentActivity = await BuildRecentActivityAsync(context, roles);

        // --- Header summary -------------------------------------------------------------------------
        var user = new DashboardUserModel
        {
            DisplayName = string.IsNullOrWhiteSpace(context.DisplayName) ? "משתמש" : context.DisplayName,
            RoleLabels = roles.HebrewLabels,
            StateSummary = BuildStateSummary(personalTasksToday.Count, recommendations.Count, warnings.Count),
        };

        return new DashboardModel
        {
            User = user,
            Kpis = kpis,
            PersonalTasksToday = personalTasksToday,
            Recommendations = recommendations,
            EarlyWarnings = warnings,
            RecentActivity = recentActivity,
        };
    }

    private static List<DashboardActionItemModel> BuildRecommendations(
        IReadOnlyList<DashboardServiceCallRow> serviceCalls,
        IReadOnlyList<DashboardProjectAttentionRow> projects,
        IReadOnlyList<DashboardQuoteFollowUpRow> quotes,
        IReadOnlyList<DashboardCustomerContactGapRow> customerGaps,
        IReadOnlyList<DashboardDraftReportRow> draftReports,
        IReadOnlyList<InventoryItem> lowStock,
        RoleSet roles,
        DateTime today)
    {
        var items = new List<DashboardActionItemModel>();

        // Rule: open service call has no assignee -> assign one (urgent ranks highest).
        // Rule: service call assigned to me -> handle it.
        foreach (var call in serviceCalls)
        {
            if (call.IsUnassigned)
            {
                items.Add(new DashboardActionItemModel
                {
                    Id = $"sc-unassigned-{call.WorkItemId}",
                    Type = "serviceCallUnassigned",
                    Title = call.IsUrgent ? "קריאת שירות דחופה ללא טכנאי" : "קריאת שירות ללא טכנאי",
                    Description = "קריאת שירות פתוחה שאינה משויכת לאף עובד. יש לשבץ טכנאי כדי שהטיפול יתחיל.",
                    Severity = call.IsUrgent ? SeverityCritical : SeverityAttention,
                    PriorityScore = (call.IsUrgent ? 280 : 180) + DaysSince(call.CreatedAt, today),
                    EntityType = "ServiceCall",
                    EntityId = call.WorkItemId,
                    ActionLabel = "שיבוץ טכנאי",
                    ActionRoute = $"/service-calls?serviceCallId={call.WorkItemId}",
                    RelevantDate = call.CreatedAt,
                    Context = BuildContext(call.CustomerName, call.SiteName),
                });
            }
            else if (call.IsAssignedToMe)
            {
                items.Add(new DashboardActionItemModel
                {
                    Id = $"sc-mine-{call.WorkItemId}",
                    Type = "serviceCallMine",
                    Title = call.IsUrgent ? "קריאת שירות דחופה שלך" : "קריאת שירות פתוחה שלך",
                    Description = "קריאת שירות פתוחה המשויכת אליך וממתינה לטיפול.",
                    Severity = call.IsUrgent ? SeverityAttention : SeverityInfo,
                    PriorityScore = (call.IsUrgent ? 160 : 110) + DaysSince(call.CreatedAt, today),
                    EntityType = "ServiceCall",
                    EntityId = call.WorkItemId,
                    ActionLabel = "פתיחת קריאה",
                    ActionRoute = $"/service-calls?serviceCallId={call.WorkItemId}",
                    RelevantDate = call.CreatedAt,
                    Context = BuildContext(call.CustomerName, call.SiteName),
                });
            }
        }

        // Rule: active project has no project manager -> assign one.
        foreach (var project in projects.Where(p => p.HasNoProjectManager))
        {
            items.Add(new DashboardActionItemModel
            {
                Id = $"proj-nopm-{project.WorkItemId}",
                Type = "projectNoManager",
                Title = "פרויקט פעיל ללא מנהל פרויקט",
                Description = "לפרויקט פעיל לא משויך מנהל פרויקט. יש לשייך אחראי כדי לשמור על מעקב וניהול.",
                Severity = SeverityAttention,
                PriorityScore = 150 + (project.OverdueTaskCount * 5),
                EntityType = "Project",
                EntityId = project.WorkItemId,
                ActionLabel = "שיוך מנהל פרויקט",
                ActionRoute = $"/projects?projectId={project.WorkItemId}",
                Context = BuildContext(project.CustomerName, project.FinanceProjectNumber),
            });
        }

        // Rule: sent/tracking quote with no recent activity (and still valid) -> follow up.
        foreach (var quote in quotes.Where(q => !q.IsExpired))
        {
            items.Add(new DashboardActionItemModel
            {
                Id = $"quote-followup-{quote.QuoteId}",
                Type = "quoteFollowUp",
                Title = "הצעת מחיר ממתינה למעקב",
                Description = $"הצעת מחיר {quote.QuoteNumber} נשלחה ללקוח ואין לגביה פעילות כבר {quote.DaysSinceActivity} ימים. כדאי ליצור קשר.",
                Severity = quote.DaysSinceActivity >= 14 ? SeverityAttention : SeverityInfo,
                PriorityScore = 90 + quote.DaysSinceActivity,
                EntityType = "Quote",
                EntityId = quote.QuoteId,
                ActionLabel = "מעקב הצעה",
                ActionRoute = $"/quotes?quoteId={quote.QuoteId}",
                RelevantDate = quote.QuoteDate,
                Context = BuildContext(quote.CustomerName, quote.ProjectTitle),
            });
        }

        // Rule: active customer with no reachable phone/email/contact -> complete contact details.
        foreach (var customer in customerGaps)
        {
            items.Add(new DashboardActionItemModel
            {
                Id = $"cust-contact-{customer.CustomerId}",
                Type = "customerMissingContact",
                Title = "לקוח פעיל ללא פרטי התקשרות",
                Description = "ללקוח פעיל אין טלפון, דוא\"ל או איש קשר זמין. יש להשלים פרטי התקשרות שמישים.",
                Severity = SeverityInfo,
                PriorityScore = 70,
                EntityType = "Customer",
                EntityId = customer.CustomerId,
                ActionLabel = "השלמת פרטים",
                ActionRoute = $"/customers?customerId={customer.CustomerId}",
                Context = BuildContext(customer.CustomerName, customer.City),
            });
        }

        // Rule: caller has a draft (unsubmitted) work report -> complete and submit it.
        foreach (var report in draftReports)
        {
            items.Add(new DashboardActionItemModel
            {
                Id = $"report-draft-{report.WorkReportId}",
                Type = "reportDraft",
                Title = "דוח עבודה בטיוטה",
                Description = "התחלת דוח עבודה שעדיין לא הוגש. יש להשלים ולהגיש אותו.",
                Severity = SeverityAttention,
                PriorityScore = 120 + (report.ReportDate.HasValue ? DaysSince(report.ReportDate.Value, today) : 0),
                EntityType = "WorkReport",
                EntityId = report.WorkReportId,
                ActionLabel = "השלמת דוח",
                ActionRoute = "/reports",
                RelevantDate = report.ReportDate,
                Context = BuildContext(report.ProjectName, report.CustomerName),
            });
        }

        // Rule: inventory item at or below its minimum quantity -> reorder.
        foreach (var item in lowStock)
        {
            var isOut = item.QuantityOnHand <= 0;
            items.Add(new DashboardActionItemModel
            {
                Id = $"stock-{item.InventoryItemId}",
                Type = "lowStock",
                Title = isOut ? "פריט מלאי אזל" : "פריט מלאי מתחת למינימום",
                Description = $"במלאי {FormatQuantity(item.QuantityOnHand)} {item.Unit} מתוך מינימום {FormatQuantity(item.MinimumQuantity ?? 0)}. כדאי להזמין חידוש מלאי.",
                Severity = isOut ? SeverityAttention : SeverityInfo,
                PriorityScore = 80 + (int)Math.Min(40, Math.Max(0, (item.MinimumQuantity ?? 0) - item.QuantityOnHand)),
                EntityType = "InventoryItem",
                EntityId = item.InventoryItemId,
                ActionLabel = "מסך המלאי",
                ActionRoute = "/inventory",
                Context = BuildContext(item.SkuCode, item.ItemName),
            });
        }

        return items
            .GroupBy(i => $"{i.EntityType}|{i.EntityId}|{i.Type}")
            .Select(g => g.First())
            .OrderByDescending(i => i.PriorityScore)
            .Take(MaxRecommendations)
            .ToList();
    }

    private static List<DashboardWarningModel> BuildWarnings(
        IReadOnlyList<DashboardPersonalTaskRow> overduePersonalTasks,
        IReadOnlyList<DashboardProjectAttentionRow> projects,
        IReadOnlyList<DashboardQuoteFollowUpRow> quotes,
        HashSet<int> projectsUsedInRecommendations,
        RoleSet roles,
        DateTime today)
    {
        var items = new List<DashboardWarningModel>();

        // Warning: a personal task is overdue (still open after its planned finish date).
        foreach (var task in overduePersonalTasks)
        {
            var daysOverdue = task.PlannedEnd.HasValue ? Math.Max(0, (today - task.PlannedEnd.Value.Date).Days) : 0;
            // Unambiguous wording: state the planned finish date and that the task is still open — never
            // imply the task was scheduled for that finish date (its daily placement is by plannedStart).
            var plannedEndText = task.PlannedEnd.HasValue
                ? task.PlannedEnd.Value.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture)
                : null;
            items.Add(new DashboardWarningModel
            {
                Id = $"task-overdue-{task.WorkItemId}",
                Type = "personalTaskOverdue",
                Title = $"המשימה \"{task.Title}\" באיחור",
                Description = plannedEndText != null
                    ? $"מועד הסיום המתוכנן היה {plannedEndText} והמשימה עדיין פתוחה."
                    : "המשימה עדיין פתוחה לאחר מועד הסיום המתוכנן.",
                Severity = daysOverdue >= 7 ? SeverityCritical : SeverityAttention,
                EntityType = "WorkItem",
                EntityId = task.WorkItemId,
                ActionLabel = "פתיחת המשימה",
                // Open WorkPlan on the task's plannedStart day (its daily placement), not its finish date,
                // and deep-link the exact WorkItem so its details drawer opens automatically.
                ActionRoute = BuildPersonalWorkPlanRoute(task.PlannedStart, task.WorkItemId, today),
                RelevantDate = task.PlannedEnd,
                Context = BuildContext(task.ProjectTitle, task.CustomerName),
            });
        }

        // Warning: active project (with a PM) has overdue tasks. No-PM projects are handled as a recommendation.
        if (roles.CanViewProjects)
        {
            foreach (var project in projects.Where(p => p.OverdueTaskCount > 0 && !projectsUsedInRecommendations.Contains(p.WorkItemId)))
            {
                items.Add(new DashboardWarningModel
                {
                    Id = $"proj-overdue-{project.WorkItemId}",
                    Type = "projectOverdueTasks",
                    Title = "פרויקט עם משימות באיחור",
                    Description = $"בפרויקט \"{project.Title}\" יש {project.OverdueTaskCount} משימות שחרגו מתאריך היעד.",
                    Severity = project.OverdueTaskCount >= 3 ? SeverityCritical : SeverityAttention,
                    EntityType = "Project",
                    EntityId = project.WorkItemId,
                    ActionLabel = "פתיחת הפרויקט",
                    ActionRoute = $"/projects?projectId={project.WorkItemId}",
                    RelevantDate = project.NearestOverdueDate,
                    Context = BuildContext(project.CustomerName, project.FinanceProjectNumber),
                });
            }
        }

        // Warning: a sent/tracking quote has passed its validity date.
        if (roles.CanViewQuotes)
        {
            foreach (var quote in quotes.Where(q => q.IsExpired))
            {
                items.Add(new DashboardWarningModel
                {
                    Id = $"quote-expired-{quote.QuoteId}",
                    Type = "quoteExpired",
                    Title = "הצעת מחיר שתוקפה פג",
                    Description = $"הצעת מחיר {quote.QuoteNumber} עברה את תאריך התוקף ועדיין במעקב.",
                    Severity = SeverityAttention,
                    EntityType = "Quote",
                    EntityId = quote.QuoteId,
                    ActionLabel = "פתיחת ההצעה",
                    ActionRoute = $"/quotes?quoteId={quote.QuoteId}",
                    RelevantDate = quote.ValidUntil,
                    Context = BuildContext(quote.CustomerName, quote.ProjectTitle),
                });
            }
        }

        return items
            .GroupBy(i => i.Id)
            .Select(g => g.First())
            .OrderBy(i => SeverityRank(i.Severity))
            .ThenBy(i => i.RelevantDate ?? DateTime.MaxValue)
            .Take(MaxWarnings)
            .ToList();
    }

    private static List<DashboardKpiModel> BuildKpis(
        RoleSet roles,
        int tasksToday,
        int overduePersonal,
        IReadOnlyList<DashboardServiceCallRow> serviceCalls,
        int projectsAttention,
        int quotesFollowUp,
        int customersMissing,
        int draftReports,
        int lowStock,
        DateTime today)
    {
        var candidates = new Dictionary<string, DashboardKpiModel>();

        candidates["myTasksToday"] = new DashboardKpiModel
        {
            Id = "myTasksToday",
            Label = "המשימות שלי להיום",
            Value = tasksToday,
            Context = "משימות מתוכננות להיום",
            Tone = tasksToday > 0 ? "primary" : "neutral",
            ActionRoute = $"/workplan?scope=personal&date={today:yyyy-MM-dd}",
        };

        if (roles.CanViewServiceCalls)
        {
            var myCalls = serviceCalls.Count(c => c.IsAssignedToMe);
            var urgentOrUnassigned = serviceCalls.Count(c => c.IsUrgent || c.IsUnassigned);

            candidates["myServiceCalls"] = new DashboardKpiModel
            {
                Id = "myServiceCalls",
                Label = "קריאות השירות שלי",
                Value = myCalls,
                Context = "קריאות פתוחות המשויכות אליך",
                Tone = myCalls > 0 ? "warning" : "neutral",
                ActionRoute = "/service-calls",
            };

            candidates["urgentCalls"] = new DashboardKpiModel
            {
                Id = "urgentCalls",
                Label = "קריאות דחופות / ללא שיבוץ",
                Value = urgentOrUnassigned,
                Context = "קריאות שירות הדורשות טיפול מיידי",
                Tone = urgentOrUnassigned > 0 ? "danger" : "success",
                ActionRoute = "/service-calls",
            };
        }

        if (roles.CanViewProjects)
        {
            candidates["projectsAttention"] = new DashboardKpiModel
            {
                Id = "projectsAttention",
                Label = "פרויקטים הדורשים תשומת לב",
                Value = projectsAttention,
                Context = "ללא מנהל או עם משימות באיחור",
                Tone = projectsAttention > 0 ? "warning" : "success",
                ActionRoute = "/projects",
            };
        }

        if (roles.CanViewQuotes)
        {
            candidates["quotesFollowUp"] = new DashboardKpiModel
            {
                Id = "quotesFollowUp",
                Label = "הצעות מחיר למעקב",
                Value = quotesFollowUp,
                Context = "הצעות שנשלחו וממתינות למענה",
                Tone = quotesFollowUp > 0 ? "warning" : "neutral",
                ActionRoute = "/quotes",
            };
        }

        if (roles.CanSeeCustomerCompleteness)
        {
            candidates["customersMissing"] = new DashboardKpiModel
            {
                Id = "customersMissing",
                Label = "לקוחות ללא פרטי קשר",
                Value = customersMissing,
                Context = "לקוחות פעילים ללא דרך התקשרות",
                Tone = customersMissing > 0 ? "warning" : "success",
                ActionRoute = "/customers",
            };
        }

        if (roles.CanViewInventory)
        {
            candidates["lowStock"] = new DashboardKpiModel
            {
                Id = "lowStock",
                Label = "פריטים במחסור",
                Value = lowStock,
                Context = "פריטים מתחת לכמות מינימום",
                Tone = lowStock > 0 ? "warning" : "success",
                ActionRoute = "/inventory",
            };
        }

        if (roles.CanViewReports)
        {
            candidates["draftReports"] = new DashboardKpiModel
            {
                Id = "draftReports",
                Label = "דוחות בטיוטה",
                Value = draftReports,
                Context = "דוחות עבודה שטרם הוגשו",
                Tone = draftReports > 0 ? "warning" : "neutral",
                ActionRoute = "/reports",
            };
        }

        candidates["myOverdue"] = new DashboardKpiModel
        {
            Id = "myOverdue",
            Label = "המשימות שלי באיחור",
            Value = overduePersonal,
            Context = "משימות שחרגו מתאריך היעד",
            Tone = overduePersonal > 0 ? "danger" : "success",
            ActionRoute = $"/workplan?scope=personal&date={today:yyyy-MM-dd}",
        };

        // Role-ordered preference lists; merged (management first) and de-duplicated, capped at four.
        var ordered = new List<string>();
        void AddOrder(IEnumerable<string> ids)
        {
            foreach (var id in ids)
            {
                if (!ordered.Contains(id))
                {
                    ordered.Add(id);
                }
            }
        }

        if (roles.IsManagement)
        {
            AddOrder(new[] { "myTasksToday", "projectsAttention", "urgentCalls", "quotesFollowUp" });
        }
        if (roles.IsProjectManager)
        {
            AddOrder(new[] { "myTasksToday", "projectsAttention", "urgentCalls", "myOverdue" });
        }
        if (roles.IsOffice)
        {
            AddOrder(new[] { "myTasksToday", "urgentCalls", "quotesFollowUp", "customersMissing" });
        }
        if (roles.IsTechnician)
        {
            AddOrder(new[] { "myTasksToday", "myOverdue", "myServiceCalls", "draftReports" });
        }
        if (roles.IsInventory)
        {
            AddOrder(new[] { "myTasksToday", "lowStock" });
        }
        // Fallback so every authenticated user always gets at least their personal task count.
        AddOrder(new[] { "myTasksToday" });

        return ordered
            .Where(candidates.ContainsKey)
            .Select(id => candidates[id])
            .Take(MaxKpis)
            .ToList();
    }

    private async Task<List<DashboardActivityModel>> BuildRecentActivityAsync(DashboardContext context, RoleSet roles)
    {
        try
        {
            // Management sees org-wide business activity; everyone else sees only their own audited actions.
            var query = new AuditLogQuery
            {
                MaxRows = roles.CanViewAuditLog ? 40 : 20,
                UserId = roles.CanViewAuditLog ? null : context.UserId,
            };

            var entries = await _auditLogService.GetListAsync(query);

            return entries
                .Where(IsBusinessActivity)
                .Take(MaxRecentActivity)
                .Select(entry => new DashboardActivityModel
                {
                    Id = $"audit-{entry.AuditLogId}",
                    Title = entry.Summary,
                    Description = null,
                    ActorName = entry.UserName,
                    OccurredAtUtc = entry.OccurredAtUtc,
                    Severity = MapAuditSeverity(entry.Severity),
                    EntityType = entry.EntityType,
                    EntityId = entry.EntityId,
                    ActionRoute = ResolveActivityRoute(entry, roles),
                })
                .ToList();
        }
        catch (Exception ex)
        {
            // Recent activity is non-critical; never let it break the dashboard.
            _logger.LogWarning(ex, "Failed to load recent activity for the dashboard; returning an empty section.");
            return new List<DashboardActivityModel>();
        }
    }

    // Only meaningful business state changes; never secrets, never routine logins, never lockout noise.
    private static bool IsBusinessActivity(AuditLogEntry entry)
    {
        if (string.IsNullOrWhiteSpace(entry.Action))
        {
            return false;
        }

        var action = entry.Action;

        if (action.Contains("Secret", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        if (action.StartsWith("Login", StringComparison.OrdinalIgnoreCase) ||
            action.Contains("Lockout", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return action.StartsWith("WorkItem", StringComparison.OrdinalIgnoreCase)
            || action.StartsWith("ServiceCall", StringComparison.OrdinalIgnoreCase)
            || action.StartsWith("User", StringComparison.OrdinalIgnoreCase)
            || action.StartsWith("CustomerSystem", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ResolveActivityRoute(AuditLogEntry entry, RoleSet roles)
    {
        if (!entry.EntityId.HasValue || string.IsNullOrWhiteSpace(entry.EntityType))
        {
            return null;
        }

        return entry.EntityType switch
        {
            "ServiceCall" when roles.CanViewServiceCalls => $"/service-calls?serviceCallId={entry.EntityId.Value}",
            "WorkItem" when roles.CanViewWorkPlan => "/workplan",
            _ => null,
        };
    }

    private static string BuildStateSummary(int tasksToday, int recommendations, int warnings)
    {
        if (tasksToday == 0 && recommendations == 0 && warnings == 0)
        {
            return "אין משימות פתוחות או התראות הדורשות טיפול כרגע.";
        }

        var parts = new List<string>();
        parts.Add(tasksToday == 1 ? "משימה אחת להיום" : $"{tasksToday} משימות להיום");
        if (recommendations > 0)
        {
            parts.Add(recommendations == 1 ? "המלצה אחת לביצוע" : $"{recommendations} המלצות לביצוע");
        }
        if (warnings > 0)
        {
            parts.Add(warnings == 1 ? "התראה אחת" : $"{warnings} התראות");
        }

        return "יש לך " + string.Join(", ", parts) + ".";
    }

    // A personal task belongs to "today" ONLY when it has a planned start whose date equals the current
    // server-local date (no timezone reinterpretation). plannedEnd is intentionally NOT considered, so a
    // multi-day task is never surfaced as "today" on a day other than its start (e.g. PlannedStart
    // 2026-06-14 / PlannedEnd 2026-06-17 must not appear on 2026-06-17). Tasks with no planned start are
    // unscheduled and are excluded from the today list.
    private static bool IsToday(DateTime? plannedStart, DateTime today)
    {
        return plannedStart.HasValue
            && plannedStart.Value.Date == today.Date;
    }

    // Builds a personal WorkPlan deep link that lands on the task's own day (its plannedStart, which is how
    // WorkPlan places tasks on the daily view) and opens the exact WorkItem's details drawer via workItemId.
    private static string BuildPersonalWorkPlanRoute(DateTime? anchorDate, int workItemId, DateTime today)
    {
        var date = (anchorDate?.Date ?? today.Date).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return $"/workplan?scope=personal&date={date}&workItemId={workItemId}";
    }

    private static int DaysSince(DateTime value, DateTime today) =>
        Math.Max(0, (today - value.Date).Days);

    private static int SeverityRank(string severity) => severity switch
    {
        SeverityCritical => 0,
        SeverityAttention => 1,
        _ => 2,
    };

    private static string MapAuditSeverity(string severity) => severity switch
    {
        "Critical" => SeverityCritical,
        "Warning" => SeverityAttention,
        _ => SeverityInfo,
    };

    private static string? BuildContext(string? primary, string? secondary)
    {
        var parts = new[] { primary, secondary }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .ToList();
        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }

    private static string FormatQuantity(decimal value) =>
        value == Math.Truncate(value)
            ? ((long)value).ToString(CultureInfo.InvariantCulture)
            : value.ToString("0.##", CultureInfo.InvariantCulture);

    // Resolves the caller's effective permissions from their roles, mirroring the server authorization
    // policy matrix. Kept local so the dashboard never widens access beyond the existing module policies.
    private sealed class RoleSet
    {
        public RoleSet(IReadOnlyList<string> roles)
        {
            bool Has(string role) => roles.Any(r => string.Equals(r, role, StringComparison.OrdinalIgnoreCase));

            IsAdmin = Has("Admin");
            IsSeniorManagement = Has("SeniorManagement");
            IsProjectManager = Has("ProjectManager");
            IsOffice = Has("Office");
            IsTechnician = Has("Technician");
            IsInventory = Has("Inventory");

            var labels = new List<string>();
            if (IsAdmin) labels.Add("מנהל מערכת");
            if (IsSeniorManagement) labels.Add("הנהלה בכירה");
            if (IsProjectManager) labels.Add("מנהל פרויקטים");
            if (IsOffice) labels.Add("משרד");
            if (IsTechnician) labels.Add("טכנאי");
            if (IsInventory) labels.Add("מחסן");
            HebrewLabels = labels;
        }

        public bool IsAdmin { get; }
        public bool IsSeniorManagement { get; }
        public bool IsProjectManager { get; }
        public bool IsOffice { get; }
        public bool IsTechnician { get; }
        public bool IsInventory { get; }

        public IReadOnlyList<string> HebrewLabels { get; }

        public bool IsManagement => IsAdmin || IsSeniorManagement;

        public bool CanViewProjects => IsManagement || IsProjectManager;
        public bool CanViewServiceCalls => IsManagement || IsProjectManager || IsOffice || IsTechnician;
        public bool CanViewQuotes => IsManagement || IsOffice;
        public bool CanViewInventory => IsManagement || IsInventory;
        public bool CanViewReports => IsManagement || IsProjectManager || IsOffice || IsTechnician;
        public bool CanViewWorkPlan => IsManagement || IsProjectManager || IsOffice || IsTechnician;
        public bool CanViewAuditLog => IsManagement;

        // Org-wide service-call visibility: those who triage/own service calls (not technician-only).
        public bool CanSeeOrgServiceCalls => IsManagement || IsProjectManager || IsOffice;

        // Customer completeness follow-up belongs to management and office workflows.
        public bool CanSeeCustomerCompleteness => IsManagement || IsOffice;
    }
}
