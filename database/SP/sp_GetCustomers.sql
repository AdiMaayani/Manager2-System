SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_GetCustomers                                              */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_GetCustomers]
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
    ORDER BY CustomerId DESC;
END
GO
