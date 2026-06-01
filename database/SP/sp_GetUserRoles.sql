SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_GetUserRoles]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT R.RoleName
    FROM dbo.UserRoles UR
    INNER JOIN dbo.Roles R ON UR.RoleId = R.RoleId
    WHERE UR.UserId = @UserId
      AND UR.IsActive = 1
    ORDER BY R.RoleName;
END;
GO
