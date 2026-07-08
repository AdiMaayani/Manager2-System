SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetCustomersMissingContactInfo
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (50)
        cu.CustomerId,
        cu.CustomerName,
        cu.CustomerType,
        cu.City,
        cu.Status
    FROM dbo.Customers AS cu
    WHERE cu.IsActive = 1
      AND NULLIF(LTRIM(RTRIM(cu.PrimaryPhone)), N'') IS NULL
      AND NULLIF(LTRIM(RTRIM(cu.PrimaryEmail)), N'') IS NULL
      AND NULLIF(LTRIM(RTRIM(cu.Phone)), N'') IS NULL
      AND NULLIF(LTRIM(RTRIM(cu.Email)), N'') IS NULL
      AND NOT EXISTS (
            SELECT 1
            FROM dbo.Contacts AS ct
            WHERE ct.CustomerId = cu.CustomerId
              AND ct.IsActive = 1
              AND (
                    NULLIF(LTRIM(RTRIM(ct.Phone)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(ct.SecondaryPhone)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(ct.Email)), N'') IS NOT NULL
              )
      )
    ORDER BY cu.CustomerName ASC;
END
GO
