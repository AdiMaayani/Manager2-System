SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_GetUserDepartments]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT D.DepartmentName
    FROM dbo.UserDepartments UD
    INNER JOIN dbo.Departments D ON UD.DepartmentId = D.DepartmentId
    WHERE UD.UserId = @UserId
      AND UD.IsActive = 1
    ORDER BY D.DepartmentName;
END;
GO
