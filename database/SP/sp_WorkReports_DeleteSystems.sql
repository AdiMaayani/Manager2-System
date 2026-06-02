SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_DeleteSystems
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId;
END
GO
