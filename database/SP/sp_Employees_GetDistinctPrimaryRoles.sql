SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Employees_GetDistinctPrimaryRoles
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT LTRIM(RTRIM(PrimaryRole)) AS PrimaryRole
    FROM dbo.Employees
    WHERE IsActive = 1
      AND LTRIM(RTRIM(ISNULL(PrimaryRole, N''))) <> N''
    ORDER BY PrimaryRole;
END
GO
