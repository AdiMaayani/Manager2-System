SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_CreateEmployee
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

    INSERT INTO dbo.Employees
    (
        FullName,
        PrimaryRole,
        Phone,
        Email,
        DailyCapacityHours,
        IsAssignable,
        IsActive,
        CreatedAt
    )
    VALUES
    (
        @FullName,
        @PrimaryRole,
        @Phone,
        @Email,
        @DailyCapacityHours,
        @IsAssignable,
        @IsActive,
        SYSDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS EmployeeId;
END
GO
