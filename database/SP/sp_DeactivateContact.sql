SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_DeactivateContact                                         */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_DeactivateContact]
    @ContactId INT,
    @UpdatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Contacts
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE ContactId = @ContactId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
