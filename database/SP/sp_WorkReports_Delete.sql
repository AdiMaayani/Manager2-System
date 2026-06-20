SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Delete
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DELETE FROM dbo.WorkReportEmployeeAssignments
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReports
    WHERE WorkReportId = @WorkReportId;

    SELECT @@ROWCOUNT AS RowsAffected;

    COMMIT TRANSACTION;
END
GO
