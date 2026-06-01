SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_Rec_GetAssignmentInput]
    @ProjectId INT = NULL,
    @PlanningDate DATETIME2 = NULL,
    @WorkItemIdsCsv NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SelectedTasks TABLE
    (
        WorkItemId INT PRIMARY KEY
    );

    IF @WorkItemIdsCsv IS NOT NULL AND LTRIM(RTRIM(@WorkItemIdsCsv)) <> ''
    BEGIN
        DECLARE @Xml XML;

        SET @Xml = CAST(
            '<i>' + REPLACE(LTRIM(RTRIM(@WorkItemIdsCsv)), ',', '</i><i>') + '</i>'
            AS XML
        );

        INSERT INTO @SelectedTasks (WorkItemId)
        SELECT DISTINCT TRY_CAST(T.c.value('.', 'nvarchar(50)') AS INT)
        FROM @Xml.nodes('/i') AS T(c)
        WHERE TRY_CAST(T.c.value('.', 'nvarchar(50)') AS INT) IS NOT NULL;
    END
    ELSE IF @ProjectId IS NOT NULL
    BEGIN
        INSERT INTO @SelectedTasks (WorkItemId)
        SELECT wi.WorkItemId
        FROM dbo.WorkItems wi
        WHERE wi.ParentWorkItemId = @ProjectId
          AND ISNULL(wi.Status, '') NOT IN ('Closed', 'Cancelled', 'Canceled', 'Deleted');
    END;

    SELECT
        wi.WorkItemId,
        wi.Title AS TaskTitle,
        wi.RequiredRole,
        wi.Priority,
        wi.EstimatedHours,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.IsLocked
    FROM dbo.WorkItems wi
    INNER JOIN @SelectedTasks st
        ON st.WorkItemId = wi.WorkItemId
    ORDER BY wi.PlannedStart, wi.WorkItemId;

    SELECT
        e.EmployeeId,
        e.FullName AS EmployeeName,
        e.PrimaryRole,
        e.IsAssignable,
        e.IsActive,
        e.DailyCapacityHours AS CapacityHours
    FROM dbo.Employees e
    WHERE e.IsActive = 1
    ORDER BY e.FullName;

    SELECT
        wea.WorkItemId,
        wea.EmployeeId,
        e.FullName AS EmployeeName,
        COALESCE(wi.EstimatedHours, 0) AS AssignedHours
    FROM dbo.WorkEmployeeAssignments wea
    INNER JOIN @SelectedTasks st
        ON st.WorkItemId = wea.WorkItemId
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = wea.EmployeeId
    INNER JOIN dbo.WorkItems wi
        ON wi.WorkItemId = wea.WorkItemId
    ORDER BY wea.WorkItemId, e.FullName;
END;
GO
