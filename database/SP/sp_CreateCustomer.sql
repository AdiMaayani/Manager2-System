SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_CreateCustomer                                            */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_CreateCustomer]
    @CustomerName NVARCHAR(200),
    @CustomerType NVARCHAR(50),
    @PrimaryPhone NVARCHAR(50) = NULL,
    @PrimaryEmail NVARCHAR(255) = NULL,
    @City NVARCHAR(100) = NULL,
    @Region NVARCHAR(100) = NULL,
    @Address NVARCHAR(255) = NULL,
    @Status NVARCHAR(50) = NULL,
    @Notes NVARCHAR(1000) = NULL,
    @IsActive BIT,
    @CreatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Customers
    (
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
    )
    VALUES
    (
        LTRIM(RTRIM(@CustomerName)),
        LTRIM(RTRIM(@CustomerType)),
        NULLIF(LTRIM(RTRIM(@PrimaryPhone)), ''),
        NULLIF(LTRIM(RTRIM(@PrimaryEmail)), ''),
        NULLIF(LTRIM(RTRIM(@City)), ''),
        NULLIF(LTRIM(RTRIM(@Region)), ''),
        NULLIF(LTRIM(RTRIM(@Address)), ''),
        NULLIF(LTRIM(RTRIM(@Status)), ''),
        NULLIF(LTRIM(RTRIM(@Notes)), ''),
        @IsActive,
        SYSUTCDATETIME(),
        @CreatedByUserId,
        NULL,
        NULL
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS CustomerId;
END
GO
