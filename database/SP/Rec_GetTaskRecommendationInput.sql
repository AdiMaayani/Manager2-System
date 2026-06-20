SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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
    -- Sourced from existing WorkEmployeeAssignments + WorkItems (no new tables). Excludes the
    -- current task. Feeds the workload factor (capacity vs already-committed hours).
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
    -- Sourced from existing WorkEmployeeAssignments + WorkItems (no new tables). Excludes the
    -- current task. Feeds the continuity factor.
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
