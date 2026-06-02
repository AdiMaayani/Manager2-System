SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_SetEmployeeActiveStatus
    @EmployeeId INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Employees
    SET IsActive = @IsActive
    WHERE EmployeeId = @EmployeeId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
