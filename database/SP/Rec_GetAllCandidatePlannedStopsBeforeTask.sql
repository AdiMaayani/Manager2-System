SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidatePlannedStopsBeforeTask]
    @TaskStartAt DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TaskDate DATE = CAST(@TaskStartAt AS DATE);

    SELECT
        ps.EmployeeId,
        e.FullName,
        ps.PlannedStopId,
        ps.WorkItemId,
        ps.SiteId,
        ps.PlannedDate,
        ps.PlannedStartAt,
        ps.PlannedEndAt,
        ps.InputAddress,
        ps.FormattedAddress,
        ps.ExternalPlaceRef,
        ps.ZoneId,
        ps.StopStatus
    FROM dbo.Rec_EmployeePlannedStops ps
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = ps.EmployeeId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
      AND ps.PlannedDate = @TaskDate
      AND ps.StopStatus IN (N'Planned', N'InProgress', N'Completed')
      AND ps.PlannedEndAt IS NOT NULL
      AND ps.PlannedEndAt <= @TaskStartAt
    ORDER BY ps.EmployeeId, ps.PlannedEndAt DESC;
END
GO
