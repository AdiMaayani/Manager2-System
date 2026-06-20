SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_RouteEstimates_InvalidateByTargetSiteId
    @TargetSiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Rec_RouteEstimates
    SET IsCurrent = 0
    WHERE TargetSiteId = @TargetSiteId
      AND IsCurrent = 1;

    SELECT @@ROWCOUNT AS RowsInvalidated;
END
GO
