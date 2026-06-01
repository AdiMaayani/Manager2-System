SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_DeactivateCustomer                                        */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_DeactivateCustomer]
    @CustomerId INT,
    @UpdatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Customers
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE CustomerId = @CustomerId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
