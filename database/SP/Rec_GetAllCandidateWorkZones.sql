SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidateWorkZones]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ewz.EmployeeId,
        e.FullName,
        ewz.ZoneId,
        wz.ZoneName,
        ewz.IsPrimary,
        ewz.Notes
    FROM dbo.Rec_EmployeeWorkZones ewz
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = ewz.EmployeeId
    INNER JOIN dbo.Rec_WorkZones wz
        ON wz.ZoneId = ewz.ZoneId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
    ORDER BY e.FullName, ewz.IsPrimary DESC, wz.ZoneName;
END
GO
