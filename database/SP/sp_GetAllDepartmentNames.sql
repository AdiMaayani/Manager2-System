SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_GetAllDepartmentNames]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DepartmentName
    FROM dbo.Departments
    ORDER BY DepartmentName;
END;
GO
