SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidateAvailabilityForRange]
    @StartAt DATETIME2(0),
    @EndAt DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        a.EmployeeId,
        e.FullName,
        a.AvailableFrom,
        a.AvailableTo,
        a.AvailabilityType,
        a.Source,
        a.Notes
    FROM dbo.Rec_EmployeeAvailability a
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = a.EmployeeId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
      AND a.AvailableFrom < @EndAt
      AND a.AvailableTo > @StartAt
    ORDER BY e.FullName, a.AvailableFrom;
END
GO
