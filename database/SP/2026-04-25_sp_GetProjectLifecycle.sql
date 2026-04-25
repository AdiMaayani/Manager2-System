USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetProjectLifecycle
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
    ORDER BY
        wr.ReportDate DESC,
        wr.WorkReportId DESC;

    SELECT
        COUNT(1) AS TotalMilestones,
        SUM(CASE WHEN wi.Status = 'Closed' OR wi.ClosedAt IS NOT NULL THEN 1 ELSE 0 END) AS ClosedMilestones,
        SUM(CASE WHEN NOT (wi.Status = 'Closed' OR wi.ClosedAt IS NOT NULL) THEN 1 ELSE 0 END) AS OpenMilestones,
        SUM(CASE WHEN wi.IsLocked = 1 THEN 1 ELSE 0 END) AS LockedMilestones,
        CAST(
            CASE
                WHEN COUNT(1) = 0 THEN 0
                ELSE ROUND(
                    CAST(SUM(CASE WHEN wi.Status = 'Closed' OR wi.ClosedAt IS NOT NULL THEN 1 ELSE 0 END) AS DECIMAL(10,2))
                    / CAST(COUNT(1) AS DECIMAL(10,2)) * 100,
                    2
                )
            END
            AS DECIMAL(10,2)
        ) AS ProgressPercent,
        (
            SELECT COUNT(1)
            FROM dbo.WorkReports wr
            INNER JOIN @RelatedWorkItems r ON r.WorkItemId = wr.WorkItemId
        ) AS TotalReports,
        CAST(
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM dbo.WorkReports wr
                    INNER JOIN @RelatedWorkItems r ON r.WorkItemId = wr.WorkItemId
                    WHERE ISNULL(wr.FollowUpRequired, 0) = 1
                )
                THEN 1
                ELSE 0
            END
            AS BIT
        ) AS HasFollowUps
    FROM dbo.WorkItems wi
    WHERE wi.ParentWorkItemId = @ProjectId
      AND wi.WorkType = 'Task';

END;
GO