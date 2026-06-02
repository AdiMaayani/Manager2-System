SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_GetSystems
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT SystemName
    FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId
    ORDER BY WorkReportSystemId;
END
GO
