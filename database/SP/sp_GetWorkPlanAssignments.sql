SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_GetWorkPlanAssignments]
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH RelevantWorkItems AS
    (
        SELECT WorkItemId
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId

        UNION

        SELECT WorkItemId
        FROM dbo.WorkItems
        WHERE ParentWorkItemId = @ProjectId
    )
    SELECT
        wea.WorkItemId,
        wea.EmployeeId,
        CAST(NULL AS INT) AS ContractorId,
        CAST('Employee' AS NVARCHAR(50)) AS AssignmentType,
        wea.AssignmentRole,
        wea.AssignedHours,
        wea.IsManualAssignment,
        e.FullName AS EmployeeName,
        CAST(NULL AS NVARCHAR(255)) AS ContractorName
    FROM dbo.WorkEmployeeAssignments wea
    INNER JOIN RelevantWorkItems rwi
        ON wea.WorkItemId = rwi.WorkItemId
    INNER JOIN dbo.Employees e
        ON wea.EmployeeId = e.EmployeeId

    UNION ALL

    SELECT
        wca.WorkItemId,
        CAST(NULL AS INT) AS EmployeeId,
        wca.ContractorId,
        CAST('Contractor' AS NVARCHAR(50)) AS AssignmentType,
        wca.AssignmentRole,
        CAST(NULL AS DECIMAL(5,2)) AS AssignedHours,
        CAST(0 AS BIT) AS IsManualAssignment,
        CAST(NULL AS NVARCHAR(255)) AS EmployeeName,
        c.FullName AS ContractorName
    FROM dbo.WorkContractorAssignments wca
    INNER JOIN RelevantWorkItems rwi
        ON wca.WorkItemId = rwi.WorkItemId
    INNER JOIN dbo.Contractors c
        ON wca.ContractorId = c.ContractorId

    ORDER BY WorkItemId;
END
GO
