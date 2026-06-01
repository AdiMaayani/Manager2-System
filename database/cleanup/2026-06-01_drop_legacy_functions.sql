/*
    Manual cleanup script for legacy scalar functions.

    These functions are leftovers from an unrelated previous project and are not
    part of the ManageR2 database baseline. Run this script manually in SSMS
    against the intended target database after confirming the selected context.
*/

DROP FUNCTION IF EXISTS [dbo].[fnGetAnimalType];
DROP FUNCTION IF EXISTS [dbo].[fnGetGenderDescription];
DROP FUNCTION IF EXISTS [dbo].[fnHasParticipant];
DROP FUNCTION IF EXISTS [dbo].[funcAddLeadingZero];
DROP FUNCTION IF EXISTS [dbo].[funcCalculate];
DROP FUNCTION IF EXISTS [dbo].[funcCalculateGender];
DROP FUNCTION IF EXISTS [dbo].[funcCalculateStatus];
