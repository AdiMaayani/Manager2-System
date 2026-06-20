SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_UpsertUserRole]
    @UserId INT,
    @RoleName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT;

    SELECT @RoleId = RoleId
    FROM dbo.Roles
    WHERE RoleName = @RoleName;

    IF @RoleId IS NULL
    BEGIN
        RAISERROR('RoleName was not found.', 16, 1);
        RETURN;
    END

    IF EXISTS
    (
        SELECT 1
        FROM dbo.UserRoles
        WHERE UserId = @UserId
          AND RoleId = @RoleId
    )
    BEGIN
        UPDATE dbo.UserRoles
        SET
            IsActive = 1,
            RemovedAt = NULL
        WHERE UserId = @UserId
          AND RoleId = @RoleId;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.UserRoles
        (
            UserId,
            RoleId,
            AssignedAt,
            IsActive,
            RemovedAt
        )
        VALUES
        (
            @UserId,
            @RoleId,
            SYSUTCDATETIME(),
            1,
            NULL
        );
    END
END;
GO
USE [master]
GO
ALTER DATABASE [igroup30_prod] SET  READ_WRITE
GO
