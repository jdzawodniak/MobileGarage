#Requires -Version 5.1
<#
.SYNOPSIS
  Backs up Mobile Garage SQLite DB into a folder that Google Drive can sync.

.DESCRIPTION
  Copies inventory.db plus WAL/SHM sidecars (if present) into a timestamped subfolder
  under a backup root (Google Drive "My Drive" by default).

  Set-and-forget: register a Windows Scheduled Task to run this daily (see bottom).

.PARAMETER BackupRoot
  Folder where timestamped backup dirs are created. Override with env MOBILE_GARAGE_BACKUP_ROOT.

.PARAMETER RepoRoot
  Mobile Garage repo root (parent of server\). Default: parent of this script's folder.

.PARAMETER DbPath
  Full path to inventory.db. If omitted, uses RepoRoot\server\data\inventory.db or env DB_PATH.

.PARAMETER KeepDays
  Delete backup folders older than this many days (by folder LastWriteTime). 0 = no pruning.

.EXAMPLE
  .\scripts\backup-db-to-drive.ps1

.EXAMPLE
  $env:MOBILE_GARAGE_BACKUP_ROOT = 'G:\My Drive\Backups\MobileGarage'; .\scripts\backup-db-to-drive.ps1
#>

param(
    [string] $BackupRoot = '',
    [string] $RepoRoot = '',
    [string] $DbPath = '',
    [int] $KeepDays = 30
)

$ErrorActionPreference = 'Stop'

function Get-DefaultBackupRoot {
    if ($env:MOBILE_GARAGE_BACKUP_ROOT) {
        return $env:MOBILE_GARAGE_BACKUP_ROOT.Trim()
    }
    $candidates = @(
        'G:\My Drive\MobileGarage\db-backups'
        'G:\My Drive\Backups\MobileGarage'
        (Join-Path $env:USERPROFILE 'Google Drive\My Drive\MobileGarage\db-backups')
        (Join-Path $env:USERPROFILE 'My Drive\MobileGarage\db-backups')
        (Join-Path $env:USERPROFILE 'Google Drive\MobileGarage\db-backups')
    )
    foreach ($p in $candidates) {
        $parent = Split-Path $p -Parent
        if (Test-Path $parent) { return $p }
    }
    return (Join-Path $env:USERPROFILE 'Google Drive\MobileGarage\db-backups')
}

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)

if (-not $BackupRoot) {
    $BackupRoot = Get-DefaultBackupRoot
}
$BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

if (-not $DbPath) {
    if ($env:DB_PATH) {
        $DbPath = $env:DB_PATH.Trim()
    } else {
        $DbPath = Join-Path $RepoRoot 'server\data\inventory.db'
    }
}
$DbPath = [System.IO.Path]::GetFullPath($DbPath)

if (-not (Test-Path -LiteralPath $DbPath)) {
    Write-Error "Database not found: $DbPath (set DB_PATH or -DbPath)"
}

$dataDir = Split-Path -Parent $DbPath
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($DbPath)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destDir = Join-Path $BackupRoot "backup-$stamp"

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

$files = @(
    $DbPath
    "$DbPath-wal"
    "$DbPath-shm"
)

$copied = 0
foreach ($f in $files) {
    if (Test-Path -LiteralPath $f) {
        Copy-Item -LiteralPath $f -Destination (Join-Path $destDir (Split-Path $f -Leaf)) -Force
        $copied++
    }
}

if ($copied -lt 1) {
    Write-Error 'No database files were copied.'
}

# Optional prune (by folder age under BackupRoot)
if ($KeepDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$KeepDays)
    Get-ChildItem -LiteralPath $BackupRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'backup-*' -and $_.LastWriteTime -lt $cutoff } |
        ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
}

Write-Host "OK: backed up to $destDir ($copied file(s))"

<#
--- Register a daily backup (run PowerShell as your user, once) ---

$repo = 'C:\temp\Mobile_Garage'
$script = Join-Path $repo 'scripts\backup-db-to-drive.ps1'
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -KeepDays 30"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
$trigger = New-ScheduledTaskTrigger -Daily -At 2:15AM
Register-ScheduledTask -TaskName 'MobileGarage DB backup' -Action $action -Trigger $trigger -Description 'Copy SQLite DB to Google Drive folder for sync'

Notes:
- If your Drive folder differs, set MOBILE_GARAGE_BACKUP_ROOT in the task:
  $env:MOBILE_GARAGE_BACKUP_ROOT = 'G:\My Drive\MobileGarage\db-backups'
  Or edit -BackupRoot in -Argument after -File "...ps1"
- The app can stay running; copies are quick. For maximum consistency, schedule when idle.

One-liner (same as README):

$repo = 'C:\temp\Mobile_Garage'; $script = Join-Path $repo 'scripts\backup-db-to-drive.ps1'; $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -KeepDays 30"; $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg; $trigger = New-ScheduledTaskTrigger -Daily -At 2:15AM; Register-ScheduledTask -TaskName 'MobileGarage DB backup' -Action $action -Trigger $trigger -Description 'Copy SQLite DB to Google Drive folder for sync'
#>
