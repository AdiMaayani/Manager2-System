SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_GetActiveCustomers                                        */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_GetActiveCustomers]
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
    WHERE IsActive = 1
    ORDER BY CustomerId DESC;
END
GO
