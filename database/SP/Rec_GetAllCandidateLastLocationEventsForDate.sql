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
        -- Smart Assignment ranks every active employee; IsAssignable is informational only
        -- and must not remove an active employee from candidate geographic enrichment.
        WHERE e.IsActive = 1
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
        COALESCE(LastEvents.Latitude, locationEventSite.Latitude) AS Latitude,
        COALESCE(LastEvents.Longitude, locationEventSite.Longitude) AS Longitude,
        EventDate,
        EventTime,
        Source,
        Notes
    FROM LastEvents
    LEFT JOIN dbo.Rec_SiteAddressProfile AS locationEventSite
        ON locationEventSite.SiteId = LastEvents.SiteId
    WHERE rn = 1
    ORDER BY EmployeeId;
END
GO
