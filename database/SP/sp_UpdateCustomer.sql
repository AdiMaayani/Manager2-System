SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_UpdateCustomer                                            */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateCustomer]
    @CustomerId INT,
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
    @UpdatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Customers
    SET
        CustomerName = LTRIM(RTRIM(@CustomerName)),
        CustomerType = LTRIM(RTRIM(@CustomerType)),
        PrimaryPhone = NULLIF(LTRIM(RTRIM(@PrimaryPhone)), ''),
        PrimaryEmail = NULLIF(LTRIM(RTRIM(@PrimaryEmail)), ''),
        City = NULLIF(LTRIM(RTRIM(@City)), ''),
        Region = NULLIF(LTRIM(RTRIM(@Region)), ''),
        Address = NULLIF(LTRIM(RTRIM(@Address)), ''),
        Status = NULLIF(LTRIM(RTRIM(@Status)), ''),
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), ''),
        IsActive = @IsActive,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE CustomerId = @CustomerId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO
