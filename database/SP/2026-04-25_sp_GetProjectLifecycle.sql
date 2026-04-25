USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_GetProjectLifecycle]
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        RETURN;
    END;

    DECLARE @RelatedWorkItems TABLE
    (
        WorkItemId INT PRIMARY KEY
    );

    INSERT INTO @RelatedWorkItems (WorkItemId)
    VALUES (@ProjectId);

    INSERT INTO @RelatedWorkItems (WorkItemId)
    SELECT wi.WorkItemId
    FROM dbo.WorkItems wi
    WHERE wi.ParentWorkItemId = @ProjectId
      AND wi.WorkType = 'Task';

    SELECT TOP 1
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.Status,
        wi.BillingType,
        wi.CustomerId,
        c.CustomerName,
        wi.SiteId,
        s.SiteName,
        wi.CreatedAt,
        wi.ClosedAt,
        wi.DealCloseDate,
        wi.FinanceProjectNumber,
        wi.InvoiceNumber
    FROM dbo.WorkItems wi
    LEFT JOIN dbo.Customers c ON c.CustomerId = wi.CustomerId
    LEFT JOIN dbo.Sites s ON s.SiteId = wi.SiteId
    WHERE wi.WorkItemId = @ProjectId
      AND wi.WorkType = 'Project';

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.Status,
        wi.BillingType,
        wi.CreatedAt,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.ClosedAt,
        wi.EstimatedHours,
        wi.Priority,
        wi.RequiredRole,
        wi.IsLocked
    FROM dbo.WorkItems wi
    WHERE wi.ParentWorkItemId = @ProjectId
      AND wi.WorkType = 'Task'
    ORDER BY
        CASE WHEN wi.PlannedStart IS NULL THEN 1 ELSE 0 END,
        wi.PlannedStart ASC,
        wi.CreatedAt ASC;

    SELECT
        wea.WorkItemId,
        wea.EmployeeId,
        CAST(NULL AS INT) AS ContractorId,
        CAST('Employee' AS NVARCHAR(20)) AS AssignmentType,
        wea.AssignmentRole,
        wea.AssignedHours,
        wea.IsManualAssignment,
        e.FullName AS EmployeeName,
        CAST(NULL AS NVARCHAR(100)) AS ContractorName
    FROM dbo.WorkEmployeeAssignments wea
    LEFT JOIN dbo.Employees e ON e.EmployeeId = wea.EmployeeId
    INNER JOIN @RelatedWorkItems r ON r.WorkItemId = wea.WorkItemId

    UNION ALL

    SELECT
        wca.WorkItemId,
        CAST(NULL AS INT) AS EmployeeId,
        wca.ContractorId,
        CAST('Contractor' AS NVARCHAR(20)) AS AssignmentType,
        wca.AssignmentRole,
        CAST(NULL AS DECIMAL(5,2)) AS AssignedHours,
        CAST(1 AS BIT) AS IsManualAssignment,
        CAST(NULL AS NVARCHAR(100)) AS EmployeeName,
        c.FullName AS ContractorName
    FROM dbo.WorkContractorAssignments wca
    LEFT JOIN dbo.Contractors c ON c.ContractorId = wca.ContractorId
    INNER JOIN @RelatedWorkItems r ON r.WorkItemId = wca.WorkItemId;

    SELECT
        wr.WorkReportId,
        wr.WorkItemId,
        wr.ReportType,
        wr.ReportDate,
        wr.Summary,
        wr.Notes,
        wr.ReporterName,
        wr.Status,
        ISNULL(wr.FollowUpRequired, 0) AS FollowUpRequired
    FROM dbo.WorkReports wr
    INNER JOIN @RelatedWorkItems r ON r.WorkItemId = wr.WorkItemId
    ORDER BY wr.ReportDate DESC, wr.WorkReportId DESC;

    ;WITH MilestoneStats AS
    (
        SELECT
            COUNT(1) AS TotalMilestones,

            SUM(CASE WHEN Status = 'Closed' THEN 1 ELSE 0 END) AS ClosedMilestones,

            SUM(CASE WHEN Status NOT IN ('Closed', 'Cancelled') THEN 1 ELSE 0 END) AS OpenMilestones,

            SUM(CASE WHEN Status = 'Cancelled' THEN 1 ELSE 0 END) AS CancelledMilestones,

            SUM(CASE WHEN IsLocked = 1 THEN 1 ELSE 0 END) AS LockedMilestones,

            SUM(
                CASE
                    WHEN Status NOT IN ('Closed', 'Cancelled')
                         AND PlannedEnd IS NOT NULL
                         AND PlannedEnd < GETDATE()
                    THEN 1 ELSE 0
                END
            ) AS DelayedMilestones,

            SUM(
                CASE
                    WHEN PlannedStart IS NOT NULL
                         AND PlannedEnd IS NOT NULL
                         AND PlannedEnd < PlannedStart
                    THEN 1 ELSE 0
                END
            ) AS InvalidScheduleMilestones,

            SUM(
                CASE
                    WHEN Status NOT IN ('Closed', 'Cancelled')
                         AND PlannedStart IS NOT NULL
                         AND PlannedStart >= GETDATE()
                    THEN 1 ELSE 0
                END
            ) AS UpcomingMilestones
        FROM dbo.WorkItems
        WHERE ParentWorkItemId = @ProjectId
          AND WorkType = 'Task'
    ),
    ReportStats AS
    (
        SELECT
            COUNT(1) AS TotalReports,
            CAST(
                CASE
                    WHEN SUM(CASE WHEN ISNULL(FollowUpRequired, 0) = 1 THEN 1 ELSE 0 END) > 0
                    THEN 1 ELSE 0
                END AS BIT
            ) AS HasFollowUps
        FROM dbo.WorkReports wr
        INNER JOIN @RelatedWorkItems r ON r.WorkItemId = wr.WorkItemId
    )
    SELECT
        ms.TotalMilestones,
        ms.ClosedMilestones,
        ms.OpenMilestones,
        ms.LockedMilestones,
        CAST(
            CASE
                WHEN (ms.TotalMilestones - ms.CancelledMilestones) <= 0 THEN 0
                ELSE (CAST(ms.ClosedMilestones AS DECIMAL(10,2)) / CAST((ms.TotalMilestones - ms.CancelledMilestones) AS DECIMAL(10,2))) * 100
            END
            AS DECIMAL(10,2)
        ) AS ProgressPercent,
        rs.TotalReports,
        rs.HasFollowUps,

        ms.CancelledMilestones,
        ms.DelayedMilestones,
        ms.InvalidScheduleMilestones,
        ms.UpcomingMilestones,

        CAST(
            CASE
                WHEN ms.InvalidScheduleMilestones > 0 THEN 'High'
                WHEN ms.DelayedMilestones > 0 AND rs.HasFollowUps = 1 THEN 'High'
                WHEN ms.DelayedMilestones > 0 THEN 'Medium'
                WHEN rs.HasFollowUps = 1 THEN 'Medium'
                ELSE 'Low'
            END
            AS NVARCHAR(20)
        ) AS RiskLevel,

        CAST(
            CASE
                WHEN ms.InvalidScheduleMilestones > 0 THEN 'Data Issue'
                WHEN ms.DelayedMilestones > 0 OR rs.HasFollowUps = 1 THEN 'At Risk'
                WHEN ms.OpenMilestones = 0 AND ms.TotalMilestones > 0 THEN 'Completed'
                ELSE 'On Track'
            END
            AS NVARCHAR(50)
        ) AS HealthStatus,

        CAST(
            CASE
                WHEN ms.InvalidScheduleMilestones > 0 THEN 'Project contains milestones with invalid planned date ranges.'
                WHEN ms.DelayedMilestones > 0 AND rs.HasFollowUps = 1 THEN 'Project has delayed milestones and open follow-up reports.'
                WHEN ms.DelayedMilestones > 0 THEN 'Project has delayed milestones.'
                WHEN rs.HasFollowUps = 1 THEN 'Project has reports that require follow-up.'
                WHEN ms.OpenMilestones = 0 AND ms.TotalMilestones > 0 THEN 'All active milestones are completed.'
                ELSE 'Project is currently on track.'
            END
            AS NVARCHAR(500)
        ) AS RiskReason
    FROM MilestoneStats ms
    CROSS JOIN ReportStats rs;
END;
GO
