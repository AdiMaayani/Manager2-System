SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER FUNCTION [dbo].[fnGetAnimalType](@type INT)
RETURNS NVARCHAR(10)
AS
BEGIN
	DECLARE @ReturnedType NVARCHAR(10)
	IF (@type = 0)
		BEGIN
			SET @ReturnedType = 'כלב'
		END
	ELSE IF (@type = 1)
		BEGIN
			SET @ReturnedType = 'חתול'
		END
	ELSE
		BEGIN
			SET @ReturnedType = 'טרם הוזן'
		END
	RETURN @ReturnedType
END
GO
