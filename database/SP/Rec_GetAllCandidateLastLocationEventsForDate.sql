SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidateLastLocationEventsForDate]
    @EventDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH LastEvents AS
    (
        SELECT
            le.*,
            ROW_NUMBER() OVER (
                PARTITION BY le.EmployeeId
                ORDER BY le.EventTime DESC
            ) AS rn
        FROM dbo.Rec_EmployeeLocationEvents le
        INNER JOIN dbo.Employees e
            ON e.EmployeeId = le.EmployeeId
        WHERE e.IsActive = 1
          AND e.IsAssignable = 1
          AND le.EventDate = @EventDate
    )
    SELECT
        EmployeeLocationEventId,
        EmployeeId,
        WorkItemId,
        SiteId,
        EventType,
        InputAddress,
        FormattedAddress,
        ExternalPlaceRef,
        ZoneId,
        EventDate,
        EventTime,
        Source,
        Notes
    FROM LastEvents
    WHERE rn = 1
    ORDER BY EmployeeId;
END
GO
