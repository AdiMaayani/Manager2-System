/* Static and gated runtime assertions for NULL-safe WorkItems type/category CHECK constraints. */
SET NOCOUNT ON;

DECLARE @IsArchived BIT,
        @WorkType NVARCHAR(20),
        @TaskCategory NVARCHAR(20),
        @ParentWorkItemId INT,
        @MilestoneId INT,
        @IsValidTypeCategory INT,
        @IsValidRegularNoProject INT;

/* Shared evaluators mirror CK_WorkItems_TypeCategory and CK_WorkItems_RegularNoProject. */
DECLARE @EvaluateConstraints TABLE (
    Scenario NVARCHAR(80) NOT NULL,
    ExpectTypeCategoryValid BIT NOT NULL,
    ExpectRegularNoProjectValid BIT NOT NULL
);

INSERT @EvaluateConstraints (Scenario, ExpectTypeCategoryValid, ExpectRegularNoProjectValid)
VALUES
    (N'Active Project + NULL TaskCategory', 1, 1),
    (N'Active Task + NULL TaskCategory', 0, 0),
    (N'Regular task with project parent', 0, 0),
    (N'Valid Project task', 1, 1),
    (N'Valid ServiceCall', 1, 1);

DECLARE scenario_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT Scenario, ExpectTypeCategoryValid, ExpectRegularNoProjectValid FROM @EvaluateConstraints;

DECLARE @Scenario NVARCHAR(80),
        @ExpectTypeCategoryValid BIT,
        @ExpectRegularNoProjectValid BIT;

OPEN scenario_cursor;
FETCH NEXT FROM scenario_cursor INTO @Scenario, @ExpectTypeCategoryValid, @ExpectRegularNoProjectValid;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @IsArchived = 0;
    SET @ParentWorkItemId = NULL;
    SET @MilestoneId = NULL;
    SET @TaskCategory = NULL;
    SET @WorkType = NULL;

    IF @Scenario = N'Active Project + NULL TaskCategory'
    BEGIN
        SET @WorkType = N'Project';
        SET @TaskCategory = NULL;
    END
    ELSE IF @Scenario = N'Active Task + NULL TaskCategory'
    BEGIN
        SET @WorkType = N'Task';
        SET @TaskCategory = NULL;
        SET @ParentWorkItemId = 49;
    END
    ELSE IF @Scenario = N'Regular task with project parent'
    BEGIN
        SET @WorkType = N'Task';
        SET @TaskCategory = N'Regular';
        SET @ParentWorkItemId = 49;
    END
    ELSE IF @Scenario = N'Valid Project task'
    BEGIN
        SET @WorkType = N'Task';
        SET @TaskCategory = N'Project';
        SET @ParentWorkItemId = 49;
    END
    ELSE IF @Scenario = N'Valid ServiceCall'
    BEGIN
        SET @WorkType = N'ServiceCall';
        SET @TaskCategory = N'ServiceCall';
    END
    ELSE
        THROW 51640, 'Unknown static test scenario.', 1;

    SET @IsValidTypeCategory = CASE
        WHEN @IsArchived = 1 THEN 1
        WHEN @WorkType = N'Project' AND @TaskCategory IS NULL AND @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
        WHEN @WorkType = N'Task' AND @TaskCategory = N'Regular' AND @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
        WHEN @WorkType = N'Task' AND @TaskCategory = N'Project' AND @ParentWorkItemId IS NOT NULL THEN 1
        WHEN @WorkType = N'ServiceCall' AND @TaskCategory = N'ServiceCall' AND @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
        ELSE 0
    END;

    SET @IsValidRegularNoProject = CASE
        WHEN @IsArchived = 1 THEN 1
        WHEN @WorkType <> N'Task' THEN 1
        WHEN @TaskCategory IS NULL THEN 0
        WHEN @TaskCategory <> N'Regular' THEN 1
        WHEN @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
        ELSE 0
    END;

    IF @IsValidTypeCategory <> CASE WHEN @ExpectTypeCategoryValid = 1 THEN 1 ELSE 0 END
        THROW 51641, 'Static TypeCategory assertion failed for scenario.', 1;

    IF @IsValidRegularNoProject <> CASE WHEN @ExpectRegularNoProjectValid = 1 THEN 1 ELSE 0 END
        THROW 51642, 'Static RegularNoProject assertion failed for scenario.', 1;

    FETCH NEXT FROM scenario_cursor INTO @Scenario, @ExpectTypeCategoryValid, @ExpectRegularNoProjectValid;
END;

CLOSE scenario_cursor;
DEALLOCATE scenario_cursor;

/* NULL WorkType: RegularNoProject alone may pass, but TypeCategory must fail deterministically. */
SET @IsArchived = 0;
SET @WorkType = NULL;
SET @TaskCategory = N'Regular';
SET @ParentWorkItemId = NULL;
SET @MilestoneId = NULL;

SET @IsValidRegularNoProject = CASE
    WHEN @IsArchived = 1 THEN 1
    WHEN @WorkType <> N'Task' THEN 1
    WHEN @TaskCategory IS NULL THEN 0
    WHEN @TaskCategory <> N'Regular' THEN 1
    WHEN @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
    ELSE 0
END;

SET @IsValidTypeCategory = CASE
    WHEN @IsArchived = 1 THEN 1
    WHEN @WorkType = N'Project' AND @TaskCategory IS NULL AND @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
    WHEN @WorkType = N'Task' AND @TaskCategory = N'Regular' AND @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
    WHEN @WorkType = N'Task' AND @TaskCategory = N'Project' AND @ParentWorkItemId IS NOT NULL THEN 1
    WHEN @WorkType = N'ServiceCall' AND @TaskCategory = N'ServiceCall' AND @ParentWorkItemId IS NULL AND @MilestoneId IS NULL THEN 1
    ELSE 0
END;

IF @IsValidRegularNoProject <> 1 OR @IsValidTypeCategory <> 0
    THROW 51643, 'NULL WorkType must remain blocked by TypeCategory even if RegularNoProject passes.', 1;

SELECT N'PASS' Result, N'Static TypeCategory and Task-scoped RegularNoProject assertions.' Coverage;
GO

/* Gated: trusted CHECK constraints must reject an active Task with NULL TaskCategory. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @ApprovedNonProduction BIT = 0;
IF @ApprovedNonProduction = 0
    THROW 51644, 'Set @ApprovedNonProduction=1 only in an isolated test database.', 1;
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 51645, 'Refusing system database.', 1;
IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL
    THROW 51646, 'WorkItems table missing.', 1;
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.WorkItems') AND name = N'CK_WorkItems_TypeCategory'
)
    THROW 51647, 'CK_WorkItems_TypeCategory is missing; run the corrective migration first.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    ALTER TABLE dbo.WorkItems WITH CHECK CHECK CONSTRAINT CK_WorkItems_TypeCategory;
    ALTER TABLE dbo.WorkItems WITH CHECK CHECK CONSTRAINT CK_WorkItems_RegularNoProject;

    BEGIN TRY
        INSERT dbo.WorkItems(Title, WorkType, TaskCategory, Status, CreatedAt, IsLocked, IsArchived, ParentWorkItemId)
        VALUES (N'__DB_TYPECAT_NULL_TASK__', N'Task', NULL, N'Open', SYSUTCDATETIME(), 0, 0, 49);
        THROW 51648, 'Trusted CHECK accepted active Task with NULL TaskCategory.', 1;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() NOT IN (547, 2627)
            THROW;
    END CATCH;

    ALTER TABLE dbo.WorkItems NOCHECK CONSTRAINT CK_WorkItems_TypeCategory;
    ALTER TABLE dbo.WorkItems NOCHECK CONSTRAINT CK_WorkItems_RegularNoProject;

    SELECT N'PASS' Result, N'Trusted CHECK constraints reject active Task with NULL TaskCategory.' Coverage;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
GO
