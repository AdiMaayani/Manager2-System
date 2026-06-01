SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_GetContacts                                               */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_GetContacts]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ContactId,
        FullName,
        JobTitle,
        ContactCategory,
        CustomerId,
        CompanyName,
        Phone,
        SecondaryPhone,
        Email,
        PreferredChannel,
        City,
        Address,
        Status,
        Notes,
        IsActive,
        CreatedAt,
        CreatedByUserId,
        UpdatedAt,
        UpdatedByUserId
    FROM dbo.Contacts
    ORDER BY ContactId DESC;
END
GO
