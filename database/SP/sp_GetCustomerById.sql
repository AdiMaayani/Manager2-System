SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_GetCustomerById                                           */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_GetCustomerById]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CustomerId,
        CustomerName,
        CustomerType,
        PrimaryPhone,
        PrimaryEmail,
        City,
        Region,
        Address,
        Status,
        Notes,
        IsActive,
        CreatedAt,
        CreatedByUserId,
        UpdatedAt,
        UpdatedByUserId
    FROM dbo.Customers
    WHERE CustomerId = @CustomerId;
END
GO
