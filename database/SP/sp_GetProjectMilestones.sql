SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_GetProjectMilestones]
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.WorkType,
        wi.Status,
        wi.BillingType,
        wi.CustomerId,
        wi.SiteId,
        wi.CreatedAt,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.ClosedAt,
        wi.Priority,
        wi.RequiredRole,
        wi.EstimatedHours,
        wi.ActualStart,
        wi.ActualEnd,
        wi.ActualHours,
        wi.IsLocked,

        wea.EmployeeId,
        e.FullName AS EmployeeName,
        wea.AssignmentRole,
        wea.AssignedHours,
        wea.IsManualAssignment,

        CAST(NULL AS INT) AS ContractorId,
        CAST(NULL AS NVARCHAR(200)) AS ContractorName,
        CAST(NULL AS NVARCHAR(200)) AS ContractorAssignmentRole
    FROM dbo.WorkItems wi
    INNER JOIN dbo.WorkEmployeeAssignments wea
        ON wea.WorkItemId = wi.WorkItemId
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = wea.EmployeeId
    WHERE wi.ParentWorkItemId = @ProjectId
      AND wi.WorkType = 'Task'

    UNION ALL

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.WorkType,
        wi.Status,
        wi.BillingType,
        wi.CustomerId,
        wi.SiteId,
        wi.CreatedAt,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.ClosedAt,
        wi.Priority,
        wi.RequiredRole,
        wi.EstimatedHours,
        wi.ActualStart,
        wi.ActualEnd,
        wi.ActualHours,
        wi.IsLocked,

        CAST(NULL AS INT) AS EmployeeId,
        CAST(NULL AS NVARCHAR(200)) AS EmployeeName,
        CAST(NULL AS NVARCHAR(200)) AS AssignmentRole,
        CAST(NULL AS DECIMAL(5,2)) AS AssignedHours,
        CAST(NULL AS BIT) AS IsManualAssignment,

        wca.ContractorId,
        COALESCE(NULLIF(c.CompanyName, ''), c.FullName) AS ContractorName,
        wca.AssignmentRole AS ContractorAssignmentRole
    FROM dbo.WorkItems wi
    INNER JOIN dbo.WorkContractorAssignments wca
        ON wca.WorkItemId = wi.WorkItemId
    INNER JOIN dbo.Contractors c
        ON c.ContractorId = wca.ContractorId
    WHERE wi.ParentWorkItemId = @ProjectId
      AND wi.WorkType = 'Task'

    UNION ALL

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.WorkType,
        wi.Status,
        wi.BillingType,
        wi.CustomerId,
        wi.SiteId,
        wi.CreatedAt,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.ClosedAt,
        wi.Priority,
        wi.RequiredRole,
        wi.EstimatedHours,
        wi.ActualStart,
        wi.ActualEnd,
        wi.ActualHours,
        wi.IsLocked,

        CAST(NULL AS INT) AS EmployeeId,
        CAST(NULL AS NVARCHAR(200)) AS EmployeeName,
        CAST(NULL AS NVARCHAR(200)) AS AssignmentRole,
        CAST(NULL AS DECIMAL(5,2)) AS AssignedHours,
        CAST(NULL AS BIT) AS IsManualAssignment,

        CAST(NULL AS INT) AS ContractorId,
        CAST(NULL AS NVARCHAR(200)) AS ContractorName,
        CAST(NULL AS NVARCHAR(200)) AS ContractorAssignmentRole
    FROM dbo.WorkItems wi
    WHERE wi.ParentWorkItemId = @ProjectId
      AND wi.WorkType = 'Task'
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.WorkEmployeeAssignments wea
          WHERE wea.WorkItemId = wi.WorkItemId
      )
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.WorkContractorAssignments wca
          WHERE wca.WorkItemId = wi.WorkItemId
      )

    ORDER BY WorkItemId, EmployeeId, ContractorId;
END;
GO
