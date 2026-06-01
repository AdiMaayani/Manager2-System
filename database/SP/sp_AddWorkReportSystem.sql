SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_AddWorkReportSystem]
    @WorkReportId INT,
    @SystemName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.WorkReportSystems
    (
        WorkReportId,
        SystemName,
        CreatedAt
    )
    VALUES
    (
        @WorkReportId,
        @SystemName,
        GETDATE()
    );
END;
GO
