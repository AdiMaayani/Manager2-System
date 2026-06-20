SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_GetContactsByCustomerId                                   */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_GetContactsByCustomerId]
    @CustomerId INT
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
    WHERE CustomerId = @CustomerId
    ORDER BY ContactId DESC;
END
GO
