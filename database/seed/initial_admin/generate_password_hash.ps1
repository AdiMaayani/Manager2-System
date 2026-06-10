<#
.SYNOPSIS
    Generate a PasswordHash / PasswordSalt pair compatible with ManageR2's
    PasswordService for use in 00_seed_initial_admin.sql.

.DESCRIPTION
    Mirrors apps/api/ManageR2.Infrastructure/Features/Users/Services/PasswordService.cs:
      - PBKDF2-SHA256
      - 100000 iterations
      - 16-byte random salt
      - 32-byte derived key
      - PasswordHash = Base64(key), PasswordSalt = Base64(salt)
    Password bytes use UTF-8, matching the Rfc2898DeriveBytes(string, ...) overload.

    Works in both Windows PowerShell 5.1 (.NET Framework 4.7.2+) and PowerShell 7 (pwsh).

.EXAMPLE
    ./generate_password_hash.ps1 -Password 'Admin#2026!'

.NOTES
    The salt is random, so each run prints a different (but valid) pair.
    Copy the two N'...' lines into 00_seed_initial_admin.sql.
#>
param(
    [string]$Password = 'Admin#2026!'
)

$ErrorActionPreference = 'Stop'

$iterations = 100000
$saltBytes  = 16
$keyBytes   = 32

# Random salt
$rng  = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$salt = New-Object byte[] $saltBytes
$rng.GetBytes($salt)
$rng.Dispose()

# Derive key (PBKDF2-SHA256)
$pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
    $Password, $salt, $iterations, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
$hash = $pbkdf2.GetBytes($keyBytes)
$pbkdf2.Dispose()

$hashB64 = [Convert]::ToBase64String($hash)
$saltB64 = [Convert]::ToBase64String($salt)

# Self-check: re-derive and compare (mirrors PasswordService.VerifyPassword)
$verify = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
    $Password, $salt, $iterations, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
$check = $verify.GetBytes($keyBytes)
$verify.Dispose()
$ok = [System.Linq.Enumerable]::SequenceEqual([byte[]]$hash, [byte[]]$check)

Write-Output ""
Write-Output "Password : $Password"
Write-Output "Verify   : $ok"
Write-Output ""
Write-Output "Paste these into 00_seed_initial_admin.sql:"
Write-Output ("DECLARE @PasswordHash NVARCHAR(255) = N'{0}';" -f $hashB64)
Write-Output ("DECLARE @PasswordSalt NVARCHAR(500) = N'{0}';" -f $saltB64)
Write-Output ""
