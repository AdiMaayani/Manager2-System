SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_DeleteUser]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Deactivate User
    UPDATE dbo.Users
    SET IsActive = 0
    WHERE UserId = @UserId
      AND IsActive = 1;

    DECLARE @RowsAffected INT = @@ROWCOUNT;

    IF (@RowsAffected = 0)
    BEGIN
        SELECT 0 AS RowsAffected;
        RETURN;
    END

    -- 2. Deactivate Roles
    UPDATE dbo.UserRoles
    SET IsActive = 0,
        RemovedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId
      AND IsActive = 1;

    -- 3. Deactivate Departments
    UPDATE dbo.UserDepartments
    SET IsActive = 0,
        RemovedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId
      AND IsActive = 1;

    SELECT 1 AS RowsAffected;
END
GO
