/*
    ManageR2 employees CRUD migration.

    Run this script manually in SSMS against the intended target database.
    It adds stored procedures for employee reads, create, update, and soft
    activate/deactivate. It does not alter tables or delete data.
*/

CREATE OR ALTER PROCEDURE dbo.sp_GetEmployees
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        EmployeeId,
        FullName,
        PrimaryRole,
        Phone,
        Email,
        DailyCapacityHours,
        IsAssignable,
        IsActive,
        CreatedAt
    FROM dbo.Employees
    ORDER BY FullName ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetEmployeeById
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        EmployeeId,
        FullName,
        PrimaryRole,
        Phone,
        Email,
        DailyCapacityHours,
        IsAssignable,
        IsActive,
        CreatedAt
    FROM dbo.Employees
    WHERE EmployeeId = @EmployeeId;
END
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
