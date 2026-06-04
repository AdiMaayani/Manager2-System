CREATE OR ALTER PROCEDURE dbo.sp_DeactivateSite
    @SiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE SiteId = @SiteId
          AND ClosedAt IS NULL
          AND Status NOT IN (N'Closed', N'Cancelled', N'Done')
    )
    BEGIN
        THROW 51010, 'Cannot deactivate a site that is used by open work items.', 1;
    END;

    UPDATE dbo.Sites
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        DeletedAt = SYSUTCDATETIME()
    WHERE SiteId = @SiteId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
