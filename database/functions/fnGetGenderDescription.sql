SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER FUNCTION [dbo].[fnGetGenderDescription](@Gender INT)
RETURNS NVARCHAR(10)
AS
BEGIN
	DECLARE @ReturnedGender NVARCHAR(10)
	IF @Gender = 1
		BEGIN
			SET @ReturnedGender = 'גבר'
		END
	IF @Gender = 0
		BEGIN
			SET @ReturnedGender = 'אישה'
		END	
	RETURN @ReturnedGender
	
END
GO
