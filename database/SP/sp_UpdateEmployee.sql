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
    @IsActive BIT = 1,
    @ProfessionsXml XML = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NormalizedPrimaryRole NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@PrimaryRole)), N'');
    DECLARE @RowsAffected INT;
    DECLARE @NowUtc DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @NormalizedProfessions TABLE
    (
        RoleName NVARCHAR(100) NOT NULL PRIMARY KEY,
        IsPrimary BIT NOT NULL
    );

    IF @NormalizedPrimaryRole IS NULL
        THROW 53320, 'PrimaryRole is required.', 1;

    IF @ProfessionsXml IS NOT NULL AND @ProfessionsXml.exist('/Roles') = 0
        THROW 53321, 'ProfessionsXml must have a Roles root element.', 1;

    IF @ProfessionsXml IS NOT NULL
       AND EXISTS
       (
           SELECT 1
           FROM @ProfessionsXml.nodes('/Roles/Role') AS profession(roleNode)
           WHERE LEN(profession.roleNode.value('(text())[1]', 'nvarchar(4000)')) > 100
       )
    BEGIN
        THROW 53322, 'A profession cannot exceed 100 characters.', 1;
    END;

    IF @ProfessionsXml IS NOT NULL
    BEGIN
        INSERT INTO @NormalizedProfessions (RoleName, IsPrimary)
        SELECT DISTINCT
            CONVERT(NVARCHAR(100), LTRIM(RTRIM(profession.roleNode.value('(text())[1]', 'nvarchar(4000)')))),
            0
        FROM @ProfessionsXml.nodes('/Roles/Role') AS profession(roleNode)
        WHERE DATALENGTH(LTRIM(RTRIM(profession.roleNode.value('(text())[1]', 'nvarchar(4000)')))) > 0;
    END;

    DELETE FROM @NormalizedProfessions
    WHERE RoleName = @NormalizedPrimaryRole;

    INSERT INTO @NormalizedProfessions (RoleName, IsPrimary)
    VALUES (@NormalizedPrimaryRole, 1);

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Employees
        SET
            FullName = @FullName,
            PrimaryRole = @NormalizedPrimaryRole,
            Phone = @Phone,
            Email = @Email,
            DailyCapacityHours = @DailyCapacityHours,
            IsAssignable = @IsAssignable,
            IsActive = @IsActive
        WHERE EmployeeId = @EmployeeId;

        SET @RowsAffected = @@ROWCOUNT;

        IF @RowsAffected = 1
        BEGIN
            DELETE FROM dbo.EmployeeProfessions
            WHERE EmployeeId = @EmployeeId;

            INSERT INTO dbo.EmployeeProfessions
            (
                EmployeeId,
                RoleName,
                IsPrimary,
                CreatedAtUtc,
                UpdatedAtUtc
            )
            SELECT
                @EmployeeId,
                profession.RoleName,
                profession.IsPrimary,
                @NowUtc,
                @NowUtc
            FROM @NormalizedProfessions AS profession;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;

    SELECT @RowsAffected AS RowsAffected;
END
GO
