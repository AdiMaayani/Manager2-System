SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_UpsertUserDepartment]
    @UserId INT,
    @DepartmentName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DepartmentId INT;

    SELECT @DepartmentId = DepartmentId
    FROM dbo.Departments
    WHERE DepartmentName = @DepartmentName;

    IF @DepartmentId IS NULL
    BEGIN
        RAISERROR('DepartmentName was not found.', 16, 1);
        RETURN;
    END

    IF EXISTS
    (
        SELECT 1
        FROM dbo.UserDepartments
        WHERE UserId = @UserId
          AND DepartmentId = @DepartmentId
    )
    BEGIN
        UPDATE dbo.UserDepartments
        SET
            IsActive = 1,
            RemovedAt = NULL
        WHERE UserId = @UserId
          AND DepartmentId = @DepartmentId;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.UserDepartments
        (
            UserId,
            DepartmentId,
            AssignedAt,
            IsActive,
            RemovedAt
        )
        VALUES
        (
            @UserId,
            @DepartmentId,
            SYSUTCDATETIME(),
            1,
            NULL
        );
    END
END;
GO
