SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_DeactivateUserDepartments]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.UserDepartments
    SET
        IsActive = 0,
        RemovedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END;
GO
