SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateEmployee
    @EmployeeId INT,
    @FullName NVARCHAR(100),
    @PrimaryRole NVARCHAR(100),
    @Phone NVARCHAR(20) = NULL,
    @Email NVARCHAR(100) = NULL,
    @DailyCapacityHours DECIMAL(4, 2) = NULL,
    @IsAssignable BIT = 1,
    @IsActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Employees
    SET
        FullName = @FullName,
        PrimaryRole = @PrimaryRole,
        Phone = @Phone,
        Email = @Email,
        DailyCapacityHours = @DailyCapacityHours,
        IsAssignable = @IsAssignable,
        IsActive = @IsActive
    WHERE EmployeeId = @EmployeeId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
