/*
    ManageR2 Smart Assignment — persistence wiring & New-Task targeting migration.

    Run manually in SSMS (or sqlcmd) against the target database:
        sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-15_smart_assignment_persistence_explainability.sql

    Purpose:
    - Adds dbo.Rec_GetDraftTaskRecommendationInput so the New Task flow can score candidates for the
      DRAFT task context (project/date/duration/site) instead of unrelated existing project tasks.
    - Improves dbo.Rec_GetLatestRecommendationsForTask to return the latest persisted run that actually
      contains recommendations for the task (works for project/batch scope runs, not only Task scope).

    Safety:
    - Additive only. No table changes. The recommendation-run tables (Rec_RecommendationRuns,
      Rec_TaskAssignmentRecommendations) and the create/save procedures already exist; this migration
      only adds/updates stored procedures (CREATE OR ALTER).
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =====================================================================================================
-- Draft task recommendation input.
-- Mirrors Rec_GetTaskRecommendationInput's 12 result sets, but the "task" is synthesized from the draft
-- parameters (no persisted WorkItem). Site/customer fall back to the parent project's values. A draft has
-- no defined required skills, so result set #2 is intentionally empty (professional score is then neutral).
-- =====================================================================================================
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetDraftTaskRecommendationInput]
    @ProjectId      INT,
    @PlannedStart   DATETIME2,
    @PlannedEnd     DATETIME2,
    @EstimatedHours DECIMAL(10,2) = NULL,
    @Priority       NVARCHAR(50) = NULL,
    @RequiredRole   NVARCHAR(100) = NULL,
    @SiteId         INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Resolve site/customer from the project (parent work item) when not explicitly provided.
    DECLARE @ResolvedSiteId INT =
        COALESCE(@SiteId, (SELECT SiteId FROM dbo.WorkItems WHERE WorkItemId = @ProjectId));
    DECLARE @ResolvedCustomerId INT =
        (SELECT CustomerId FROM dbo.WorkItems WHERE WorkItemId = @ProjectId);

    DECLARE @StartAt DATETIME2 = @PlannedStart;
    DECLARE @EndAt DATETIME2 = @PlannedEnd;

    --------------------------------------------------
    -- 1. TASK CORE DATA (synthesized for the draft)
    --------------------------------------------------
    SELECT
        CAST(0 AS INT)            AS WorkItemId,
        CAST(N'(טיוטה)' AS NVARCHAR(200)) AS Title,
        CAST(N'Task' AS NVARCHAR(50))     AS WorkType,
        CAST(N'Planned' AS NVARCHAR(50))  AS Status,
        @PlannedStart             AS PlannedStart,
        @PlannedEnd               AS PlannedEnd,
        @EstimatedHours           AS EstimatedHours,
        @Priority                 AS Priority,
        @RequiredRole             AS RequiredRole,
        CAST(0 AS BIT)            AS IsLocked,
        @ResolvedSiteId           AS SiteId,
        @ResolvedCustomerId       AS CustomerId,
        @ProjectId                AS ParentWorkItemId,
        CAST(NULL AS NVARCHAR(100)) AS ProjectType,
        CAST(NULL AS INT)         AS RequiredWorkersCount,
        CAST(NULL AS NVARCHAR(20)) AS AlgorithmPriorityOverride,
        CAST(NULL AS NVARCHAR(20)) AS UrgencyOverride,
        CAST(NULL AS NVARCHAR(500)) AS PlanningNotes;

    --------------------------------------------------
    -- 2. REQUIRED SKILLS (none for a draft task)
    --------------------------------------------------
    SELECT
        CAST(NULL AS INT)          AS WorkItemId,
        CAST(NULL AS INT)          AS SkillId,
        CAST(NULL AS NVARCHAR(200)) AS SkillName,
        CAST(NULL AS NVARCHAR(100)) AS SkillCategory,
        CAST(NULL AS INT)          AS RequiredLevel,
        CAST(NULL AS NVARCHAR(50)) AS ImportanceLevel
    WHERE 1 = 0;

    --------------------------------------------------
    -- 3. EMPLOYEES
    --------------------------------------------------
    SELECT
        EmployeeId,
        FullName,
        PrimaryRole,
        IsActive,
        IsAssignable,
        DailyCapacityHours
    FROM dbo.Employees
    WHERE IsActive = 1
      AND IsAssignable = 1;

    --------------------------------------------------
    -- 4. EMPLOYEE SKILLS
    --------------------------------------------------
    SELECT
        es.EmployeeId,
        es.SkillId,
        s.SkillName,
        es.SkillLevel,
        es.YearsExperience,
        es.IsCertified
    FROM dbo.Rec_EmployeeSkills es
    INNER JOIN dbo.Rec_Skills s
        ON s.SkillId = es.SkillId;

    --------------------------------------------------
    -- 5. AVAILABILITY (within the draft task window)
    --------------------------------------------------
    SELECT
        a.EmployeeId,
        a.AvailableFrom,
        a.AvailableTo,
        a.AvailabilityType,
        a.Source
    FROM dbo.Rec_EmployeeAvailability a
    WHERE a.AvailableFrom < @EndAt
      AND a.AvailableTo > @StartAt;

    --------------------------------------------------
    -- 6. CAPACITY
    --------------------------------------------------
    SELECT
        c.EmployeeId,
        c.WeeklyCapacityHours,
        c.EffectiveFrom,
        c.EffectiveTo
    FROM dbo.Rec_EmployeeCapacity c;

    --------------------------------------------------
    -- 7. EMPLOYEE BASE ADDRESSES
    --------------------------------------------------
    SELECT
        b.EmployeeId,
        b.FormattedAddress,
        b.City,
        b.ZoneId
    FROM dbo.Rec_EmployeeBaseAddress b;

    --------------------------------------------------
    -- 8. SITE ADDRESS (resolved from project/site)
    --------------------------------------------------
    SELECT
        p.SiteId,
        p.FormattedAddress,
        p.City,
        p.ZoneId
    FROM dbo.Rec_SiteAddressProfile p
    WHERE p.SiteId = @ResolvedSiteId;

    --------------------------------------------------
    -- 9. WORK ZONES
    --------------------------------------------------
    SELECT
        ewz.EmployeeId,
        ewz.ZoneId,
        ewz.IsPrimary
    FROM dbo.Rec_EmployeeWorkZones ewz;

    --------------------------------------------------
    -- 10. PLANNED STOPS (same day)
    --------------------------------------------------
    SELECT
        ps.EmployeeId,
        ps.SiteId,
        ps.PlannedStartAt,
        ps.PlannedEndAt,
        ps.FormattedAddress
    FROM dbo.Rec_EmployeePlannedStops ps
    WHERE ps.PlannedDate = CAST(@StartAt AS DATE);

    --------------------------------------------------
    -- 11. LOCATION EVENTS (same day)
    --------------------------------------------------
    SELECT
        le.EmployeeId,
        le.FormattedAddress,
        le.EventTime
    FROM dbo.Rec_EmployeeLocationEvents le
    WHERE le.EventDate = CAST(@StartAt AS DATE);

    --------------------------------------------------
    -- 12. ROUTE ESTIMATES (to the resolved site)
    --------------------------------------------------
    SELECT
        r.EmployeeId,
        r.TargetSiteId,
        r.OriginType,
        r.EstimatedDistanceKm,
        r.EstimatedTravelMinutes
    FROM dbo.Rec_RouteEstimates r
    WHERE r.IsCurrent = 1
      AND r.TargetSiteId = @ResolvedSiteId;
END
GO

-- =====================================================================================================
-- Latest persisted recommendations for a task — now scope-agnostic: returns the most recent COMPLETED
-- run that actually produced recommendations for the task (project, batch, or task scope).
-- =====================================================================================================
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetLatestRecommendationsForTask]
    @TaskId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LatestRunId INT;

    SELECT TOP 1
        @LatestRunId = r.RecommendationRunId
    FROM dbo.Rec_TaskAssignmentRecommendations r
    INNER JOIN dbo.Rec_RecommendationRuns rr
        ON rr.RecommendationRunId = r.RecommendationRunId
    WHERE r.TaskId = @TaskId
      AND rr.RunStatus = N'Completed'
    ORDER BY rr.CreatedAt DESC, r.RecommendationRunId DESC;

    SELECT
        r.RecommendationId,
        r.RecommendationRunId,
        r.TaskId,
        wi.Title AS TaskTitle,
        r.EmployeeId,
        e.FullName,
        e.PrimaryRole,
        r.UrgencyClass,
        r.OriginTypeUsed,
        r.RankOrder,
        r.TotalScore,
        r.ProfessionalScore,
        r.AvailabilityScore,
        r.WorkloadScore,
        r.ExperienceScore,
        r.GeographicScore,
        r.ContinuityScore,
        r.DistanceKm,
        r.TravelMinutes,
        r.MatchedSkillsCount,
        r.MissingSkillsCount,
        r.OpenAssignmentsCount,
        r.CurrentWorkloadHours,
        r.ZoneMatch,
        r.WorkedWithCustomerBefore,
        r.WorkedAtSiteBefore,
        r.RecommendationSummary,
        r.WarningsJson,
        r.CreatedAt
    FROM dbo.Rec_TaskAssignmentRecommendations r
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = r.EmployeeId
    INNER JOIN dbo.WorkItems wi
        ON wi.WorkItemId = r.TaskId
    WHERE r.RecommendationRunId = @LatestRunId
    ORDER BY r.RankOrder ASC;
END
GO
