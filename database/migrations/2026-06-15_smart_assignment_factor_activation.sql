/*
    ManageR2 Smart Assignment — factor activation migration.

    Run manually in SSMS (or sqlcmd) against the target database:
        sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-15_smart_assignment_factor_activation.sql

    Purpose:
    - Activates the workload and continuity scoring factors with REAL existing data by exposing two
      additional result sets from the recommendation-input procedures:
        * Result set 13 (CURRENT LOAD): open assignments + committed hours on the task day, from
          WorkEmployeeAssignments + WorkItems.EstimatedHours.
        * Result set 14 (CONTINUITY): whether the employee already worked this project / customer / site,
          from WorkEmployeeAssignments + WorkItems.
    - Updates BOTH dbo.Rec_GetTaskRecommendationInput (saved task) and dbo.Rec_GetDraftTaskRecommendationInput
      (New Task draft) so the New Task modal and the persisted runs use the same improved data.

    Safety:
    - Additive only. No table changes, no new tables. Only CREATE OR ALTER on existing procedures.
    - The two new result sets are appended after the existing 12. Consumers that have not been updated
      simply ignore them; the C# repository reads them only if present (NextResultAsync guard).
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =====================================================================================================
-- Saved task: 12 existing result sets + 13 (current load) + 14 (continuity).
-- =====================================================================================================
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetTaskRecommendationInput]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    --------------------------------------------------
    -- 1. TASK CORE DATA
    --------------------------------------------------
    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.WorkType,
        wi.Status,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.EstimatedHours,
        wi.Priority,
        wi.RequiredRole,
        wi.IsLocked,
        wi.SiteId,
        wi.CustomerId,
        wi.ParentWorkItemId,
        ap.ProjectType,
        ap.RequiredWorkersCount,
        ap.AlgorithmPriorityOverride,
        ap.UrgencyOverride,
        ap.PlanningNotes
    FROM dbo.WorkItems wi
    LEFT JOIN dbo.Rec_WorkItemAlgorithmProfile ap
        ON ap.WorkItemId = wi.WorkItemId
    WHERE wi.WorkItemId = @WorkItemId;

    --------------------------------------------------
    -- 2. REQUIRED SKILLS
    --------------------------------------------------
    SELECT
        r.WorkItemId,
        r.SkillId,
        s.SkillName,
        s.SkillCategory,
        r.RequiredLevel,
        r.ImportanceLevel
    FROM dbo.Rec_WorkItemRequiredSkills r
    INNER JOIN dbo.Rec_Skills s
        ON s.SkillId = r.SkillId
    WHERE r.WorkItemId = @WorkItemId;

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
    -- 5. AVAILABILITY (רק בטווח המשימה)
    --------------------------------------------------
    DECLARE @StartAt DATETIME2;
    DECLARE @EndAt DATETIME2;

    SELECT
        @StartAt = PlannedStart,
        @EndAt = PlannedEnd
    FROM dbo.WorkItems
    WHERE WorkItemId = @WorkItemId;

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
    -- 8. SITE ADDRESS
    --------------------------------------------------
    SELECT
        p.SiteId,
        p.FormattedAddress,
        p.City,
        p.ZoneId
    FROM dbo.Rec_SiteAddressProfile p
    WHERE p.SiteId = (
        SELECT SiteId FROM dbo.WorkItems WHERE WorkItemId = @WorkItemId
    );

    --------------------------------------------------
    -- 9. WORK ZONES
    --------------------------------------------------
    SELECT
        ewz.EmployeeId,
        ewz.ZoneId,
        ewz.IsPrimary
    FROM dbo.Rec_EmployeeWorkZones ewz;

    --------------------------------------------------
    -- 10. PLANNED STOPS (אותו יום)
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
    -- 11. LOCATION EVENTS (אותו יום)
    --------------------------------------------------
    SELECT
        le.EmployeeId,
        le.FormattedAddress,
        le.EventTime
    FROM dbo.Rec_EmployeeLocationEvents le
    WHERE le.EventDate = CAST(@StartAt AS DATE);

    --------------------------------------------------
    -- 12. ROUTE ESTIMATES
    --------------------------------------------------
    SELECT
        r.EmployeeId,
        r.TargetSiteId,
        r.OriginType,
        r.EstimatedDistanceKm,
        r.EstimatedTravelMinutes
    FROM dbo.Rec_RouteEstimates r
    WHERE r.IsCurrent = 1
      AND r.TargetSiteId = (
        SELECT SiteId FROM dbo.WorkItems WHERE WorkItemId = @WorkItemId
    );

    --------------------------------------------------
    -- 13. CURRENT LOAD — open assignments + committed hours on the task day.
    --------------------------------------------------
    SELECT
        e.EmployeeId,
        COALESCE(load.OpenAssignmentsCount, 0) AS OpenAssignmentsCount,
        CAST(COALESCE(load.CurrentAssignedHours, 0) AS DECIMAL(10,2)) AS CurrentAssignedHours
    FROM dbo.Employees e
    OUTER APPLY (
        SELECT
            COUNT(DISTINCT wiLoad.WorkItemId) AS OpenAssignmentsCount,
            SUM(COALESCE(wiLoad.EstimatedHours, 0)) AS CurrentAssignedHours
        FROM dbo.WorkEmployeeAssignments wea
        INNER JOIN dbo.WorkItems wiLoad
            ON wiLoad.WorkItemId = wea.WorkItemId
        WHERE wea.EmployeeId = e.EmployeeId
          AND wiLoad.WorkItemId <> @WorkItemId
          AND @StartAt IS NOT NULL
          AND CAST(wiLoad.PlannedStart AS DATE) = CAST(@StartAt AS DATE)
          AND ISNULL(wiLoad.Status, '') NOT IN ('Closed', 'Cancelled', 'Canceled', 'Deleted')
    ) load
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1;

    --------------------------------------------------
    -- 14. CONTINUITY — has the employee previously worked this project / customer / site?
    --------------------------------------------------
    DECLARE @ParentWorkItemId INT, @TaskCustomerId INT, @TaskSiteId INT;
    SELECT
        @ParentWorkItemId = ParentWorkItemId,
        @TaskCustomerId = CustomerId,
        @TaskSiteId = SiteId
    FROM dbo.WorkItems
    WHERE WorkItemId = @WorkItemId;

    SELECT
        e.EmployeeId,
        CAST(MAX(CASE WHEN @ParentWorkItemId IS NOT NULL AND wiHist.ParentWorkItemId = @ParentWorkItemId THEN 1 ELSE 0 END) AS BIT) AS WorkedOnProjectBefore,
        CAST(MAX(CASE WHEN @TaskCustomerId IS NOT NULL AND wiHist.CustomerId = @TaskCustomerId THEN 1 ELSE 0 END) AS BIT) AS WorkedWithCustomerBefore,
        CAST(MAX(CASE WHEN @TaskSiteId IS NOT NULL AND wiHist.SiteId = @TaskSiteId THEN 1 ELSE 0 END) AS BIT) AS WorkedAtSiteBefore,
        COUNT(DISTINCT wiHist.WorkItemId) AS TotalPriorAssignments
    FROM dbo.Employees e
    LEFT JOIN dbo.WorkEmployeeAssignments weaHist
        ON weaHist.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.WorkItems wiHist
        ON wiHist.WorkItemId = weaHist.WorkItemId
       AND wiHist.WorkItemId <> @WorkItemId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
    GROUP BY e.EmployeeId;
END
GO

-- =====================================================================================================
-- Draft task: same 14 result sets, but the "task" is synthesized from the draft parameters. Continuity
-- and current load resolve against the draft's project / customer / site and start day.
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

    --------------------------------------------------
    -- 13. CURRENT LOAD — open assignments + committed hours on the draft day.
    --------------------------------------------------
    SELECT
        e.EmployeeId,
        COALESCE(load.OpenAssignmentsCount, 0) AS OpenAssignmentsCount,
        CAST(COALESCE(load.CurrentAssignedHours, 0) AS DECIMAL(10,2)) AS CurrentAssignedHours
    FROM dbo.Employees e
    OUTER APPLY (
        SELECT
            COUNT(DISTINCT wiLoad.WorkItemId) AS OpenAssignmentsCount,
            SUM(COALESCE(wiLoad.EstimatedHours, 0)) AS CurrentAssignedHours
        FROM dbo.WorkEmployeeAssignments wea
        INNER JOIN dbo.WorkItems wiLoad
            ON wiLoad.WorkItemId = wea.WorkItemId
        WHERE wea.EmployeeId = e.EmployeeId
          AND CAST(wiLoad.PlannedStart AS DATE) = CAST(@StartAt AS DATE)
          AND ISNULL(wiLoad.Status, '') NOT IN ('Closed', 'Cancelled', 'Canceled', 'Deleted')
    ) load
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1;

    --------------------------------------------------
    -- 14. CONTINUITY — has the employee previously worked this project / customer / site?
    --------------------------------------------------
    SELECT
        e.EmployeeId,
        CAST(MAX(CASE WHEN @ProjectId IS NOT NULL AND wiHist.ParentWorkItemId = @ProjectId THEN 1 ELSE 0 END) AS BIT) AS WorkedOnProjectBefore,
        CAST(MAX(CASE WHEN @ResolvedCustomerId IS NOT NULL AND wiHist.CustomerId = @ResolvedCustomerId THEN 1 ELSE 0 END) AS BIT) AS WorkedWithCustomerBefore,
        CAST(MAX(CASE WHEN @ResolvedSiteId IS NOT NULL AND wiHist.SiteId = @ResolvedSiteId THEN 1 ELSE 0 END) AS BIT) AS WorkedAtSiteBefore,
        COUNT(DISTINCT wiHist.WorkItemId) AS TotalPriorAssignments
    FROM dbo.Employees e
    LEFT JOIN dbo.WorkEmployeeAssignments weaHist
        ON weaHist.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.WorkItems wiHist
        ON wiHist.WorkItemId = weaHist.WorkItemId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
    GROUP BY e.EmployeeId;
END
GO
