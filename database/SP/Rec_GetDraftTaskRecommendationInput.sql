SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =====================================================================================================
-- Draft task: same 14 result sets, but the "task" is synthesized from the draft parameters. Continuity
-- and current load resolve against the draft's project / customer / site and start day.
-- =====================================================================================================
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetDraftTaskRecommendationInput]
    @TaskCategory   NVARCHAR(20),
    @ProjectId      INT = NULL,
    @CustomerId     INT = NULL,
    @PlannedStart   DATETIME2,
    @PlannedEnd     DATETIME2,
    @EstimatedHours DECIMAL(10,2) = NULL,
    @Priority       NVARCHAR(50) = NULL,
    @RequiredRole   NVARCHAR(100) = NULL,
    @SiteId         INT = NULL,
    @RequiredRolesXml XML = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @TaskCategory NOT IN (N'Regular', N'Project', N'ServiceCall')
        THROW 51400, N'Invalid TaskCategory for draft recommendation.', 1;

    DECLARE @ResolvedWorkType NVARCHAR(50) = CASE @TaskCategory
        WHEN N'ServiceCall' THEN N'ServiceCall'
        ELSE N'Task'
    END;

    DECLARE @ResolvedParentWorkItemId INT = CASE WHEN @TaskCategory = N'Project' THEN @ProjectId ELSE NULL END;

    DECLARE @ResolvedSiteId INT = COALESCE(
        @SiteId,
        CASE WHEN @ProjectId IS NOT NULL THEN (SELECT SiteId FROM dbo.WorkItems WHERE WorkItemId = @ProjectId) END);

    DECLARE @ResolvedCustomerId INT = COALESCE(
        @CustomerId,
        CASE WHEN @ProjectId IS NOT NULL THEN (SELECT CustomerId FROM dbo.WorkItems WHERE WorkItemId = @ProjectId) END);

    DECLARE @ResolvedEstimatedHours DECIMAL(10,2) = COALESCE(
        @EstimatedHours,
        CASE WHEN @PlannedEnd > @PlannedStart
            THEN CAST(DATEDIFF(MINUTE, @PlannedStart, @PlannedEnd) / 60.0 AS DECIMAL(10,2))
            ELSE NULL
        END);

    DECLARE @StartAt DATETIME2 = @PlannedStart;
    DECLARE @EndAt DATETIME2 = @PlannedEnd;
    DECLARE @ResolvedRequiredRole NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@RequiredRole)), N'');
    DECLARE @ResolvedRequiredRolesXml XML;

    IF @RequiredRolesXml IS NOT NULL AND @RequiredRolesXml.exist('/Roles') = 0
        THROW 53330, 'RequiredRolesXml must have a Roles root element.', 1;

    IF @RequiredRolesXml IS NOT NULL
       AND EXISTS
       (
           SELECT 1
           FROM @RequiredRolesXml.nodes('/Roles/Role') AS requiredRole(roleNode)
           WHERE LEN(requiredRole.roleNode.value('(text())[1]', 'nvarchar(4000)')) > 100
       )
    BEGIN
        THROW 53331, 'A required role cannot exceed 100 characters.', 1;
    END;

    IF @RequiredRolesXml IS NOT NULL
    BEGIN
        SET @ResolvedRequiredRolesXml = @RequiredRolesXml;
        SET @ResolvedRequiredRole = NULL;

        SELECT TOP (1)
            @ResolvedRequiredRole = normalizedRequiredRole.RoleName
        FROM
        (
            SELECT DISTINCT
                CONVERT(NVARCHAR(100), LTRIM(RTRIM(requiredRole.roleNode.value('(text())[1]', 'nvarchar(4000)')))) AS RoleName
            FROM @RequiredRolesXml.nodes('/Roles/Role') AS requiredRole(roleNode)
            WHERE DATALENGTH(LTRIM(RTRIM(requiredRole.roleNode.value('(text())[1]', 'nvarchar(4000)')))) > 0
        ) AS normalizedRequiredRole
        ORDER BY normalizedRequiredRole.RoleName;
    END
    ELSE
    BEGIN
        SET @ResolvedRequiredRolesXml =
        (
            SELECT @ResolvedRequiredRole AS [Role]
            WHERE @ResolvedRequiredRole IS NOT NULL
            FOR XML PATH(''), ROOT('Roles'), TYPE
        );
    END;

    --------------------------------------------------
    -- 1. TASK CORE DATA (synthesized for the draft)
    --------------------------------------------------
    SELECT
        CAST(0 AS INT)            AS WorkItemId,
        CAST(N'(טיוטה)' AS NVARCHAR(200)) AS Title,
        CAST(@ResolvedWorkType AS NVARCHAR(50)) AS WorkType,
        CAST(N'Planned' AS NVARCHAR(50))  AS Status,
        @PlannedStart             AS PlannedStart,
        @PlannedEnd               AS PlannedEnd,
        @ResolvedEstimatedHours   AS EstimatedHours,
        @Priority                 AS Priority,
        @ResolvedRequiredRole     AS RequiredRole,
        @ResolvedRequiredRolesXml AS RequiredRolesXml,
        CAST(0 AS BIT)            AS IsLocked,
        @ResolvedSiteId           AS SiteId,
        @ResolvedCustomerId       AS CustomerId,
        @ResolvedParentWorkItemId AS ParentWorkItemId,
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
        employee.EmployeeId,
        employee.FullName,
        employee.PrimaryRole,
        employee.IsActive,
        employee.IsAssignable,
        employee.DailyCapacityHours,
        CASE WHEN EXISTS
        (
            SELECT 1 FROM dbo.EmployeeProfessions AS profession
            WHERE profession.EmployeeId = employee.EmployeeId
        ) THEN (
            SELECT profession.RoleName AS [Role]
            FROM dbo.EmployeeProfessions AS profession
            WHERE profession.EmployeeId = employee.EmployeeId
            ORDER BY profession.RoleName
            FOR XML PATH(''), ROOT('Roles'), TYPE
        ) ELSE CAST(NULL AS XML) END AS ProfessionsXml
    FROM dbo.Employees AS employee
    WHERE employee.IsActive = 1;

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
        b.ZoneId,
        b.Latitude,
        b.Longitude
    FROM dbo.Rec_EmployeeBaseAddress b
    WHERE b.ValidationStatus = N'Validated'
      AND b.ValidationProvider = N'Geoapify'
      AND b.Latitude BETWEEN -90 AND 90
      AND b.Longitude BETWEEN -180 AND 180;

    --------------------------------------------------
    -- 8. SITE ADDRESS (resolved from project/site)
    --------------------------------------------------
    SELECT
        p.SiteId,
        p.FormattedAddress,
        p.City,
        p.ZoneId,
        p.Latitude,
        p.Longitude
    FROM dbo.Rec_SiteAddressProfile p
    WHERE p.SiteId = @ResolvedSiteId
      AND p.ValidationStatus = N'Validated'
      AND p.ValidationProvider = N'Geoapify'
      AND p.Latitude BETWEEN -90 AND 90
      AND p.Longitude BETWEEN -180 AND 180;

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
        ps.FormattedAddress,
        COALESCE(ps.Latitude, plannedStopSite.Latitude) AS Latitude,
        COALESCE(ps.Longitude, plannedStopSite.Longitude) AS Longitude
    FROM dbo.Rec_EmployeePlannedStops ps
    LEFT JOIN dbo.Rec_SiteAddressProfile AS plannedStopSite
        ON plannedStopSite.SiteId = ps.SiteId
    WHERE ps.PlannedDate = CAST(@StartAt AS DATE);

    --------------------------------------------------
    -- 11. LOCATION EVENTS (same day)
    --------------------------------------------------
    SELECT
        le.EmployeeId,
        le.SiteId,
        le.FormattedAddress,
        le.EventTime,
        COALESCE(le.Latitude, locationEventSite.Latitude) AS Latitude,
        COALESCE(le.Longitude, locationEventSite.Longitude) AS Longitude
    FROM dbo.Rec_EmployeeLocationEvents le
    LEFT JOIN dbo.Rec_SiteAddressProfile AS locationEventSite
        ON locationEventSite.SiteId = le.SiteId
    WHERE le.EventDate = CAST(@StartAt AS DATE);

    --------------------------------------------------
    -- 12. ROUTE ESTIMATES (to the resolved site)
    --------------------------------------------------
    SELECT
        r.EmployeeId,
        r.TargetSiteId,
        r.OriginType,
        r.EstimatedDistanceKm,
        r.EstimatedTravelMinutes,
        r.RoutingProvider,
        r.CalculatedAt
    FROM dbo.Rec_RouteEstimates r
    WHERE r.IsCurrent = 1
      AND r.RoutingMode = N'Driving'
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
    WHERE e.IsActive = 1;

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
    GROUP BY e.EmployeeId;
END
GO
