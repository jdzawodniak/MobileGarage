#Requires -Version 5.1
<#
.SYNOPSIS
  Backs up Mobile Garage uploaded photos into a folder that Google Drive can sync.

.DESCRIPTION
  Default: mirrors server/uploads into a single folder ...\photos-backups\current (robocopy /MIR).
  Only one copy of each image is kept; daily runs update changed files and remove deleted ones from the mirror.

  Optional -ArchiveMode: previous behavior — timestamped backup-* folders and incremental copies vs last run.

  Backup root defaults to the same Drive root as DB backups, sibling folder photos-backups.

.PARAMETER BackupRoot
  Folder that contains the mirror (default) or timestamped backups. Override with MOBILE_GARAGE_PHOTO_BACKUP_ROOT.

.PARAMETER RepoRoot
  Mobile Garage repo root (parent of server\). Default: parent of this script's folder.

.PARAMETER UploadRoot
  Source uploads folder. If omitted, uses env UPLOAD_DIR or RepoRoot\server\uploads.

.PARAMETER ArchiveMode
  Use timestamped backup-* folders instead of a single current mirror.

.PARAMETER KeepDays
  ArchiveMode only: delete backup-* folders older than this many days. 0 = no pruning.

.PARAMETER MirrorSubfolder
  Name of the single mirror folder under BackupRoot (default: current).
#>

param(
    [string] $BackupRoot = '',
    [string] $RepoRoot = '',
    [string] $UploadRoot = '',
    [switch] $ArchiveMode,
    [int] $KeepDays = 30,
    [string] $MirrorSubfolder = 'current'
)

$ErrorActionPreference = 'Stop'

function Get-DefaultDbBackupRoot {
    if ($env:MOBILE_GARAGE_BACKUP_ROOT) {
        return $env:MOBILE_GARAGE_BACKUP_ROOT.Trim()
    }
    $candidates = @(
        'G:\My Drive\MobileGarage\db-backups'
        'G:\My Drive\Backups\MobileGarage\db-backups'
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

function Get-PhotoBackupRootFromDbRoot([string]$dbRoot) {
    if ($dbRoot -match '[\\/]db-backups$') {
        return ($dbRoot -replace '[\\/]db-backups$', '\photos-backups')
    }
    return (Join-Path $dbRoot 'photos-backups')
}

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)

if (-not $UploadRoot) {
    if ($env:UPLOAD_DIR) {
        $UploadRoot = $env:UPLOAD_DIR.Trim()
    } else {
        $UploadRoot = Join-Path $RepoRoot 'server\uploads'
    }
}
$UploadRoot = [System.IO.Path]::GetFullPath($UploadRoot)

if (-not (Test-Path -LiteralPath $UploadRoot)) {
    Write-Error "Uploads folder not found: $UploadRoot"
}

if (-not $BackupRoot) {
    if ($env:MOBILE_GARAGE_PHOTO_BACKUP_ROOT) {
        $BackupRoot = $env:MOBILE_GARAGE_PHOTO_BACKUP_ROOT.Trim()
    } else {
        $BackupRoot = Get-PhotoBackupRootFromDbRoot (Get-DefaultDbBackupRoot)
    }
}
$BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

if (-not $ArchiveMode) {
    $destMirror = Join-Path $BackupRoot $MirrorSubfolder
    New-Item -ItemType Directory -Path $destMirror -Force | Out-Null

    $robocopy = Join-Path $env:SystemRoot 'System32\robocopy.exe'
    if (-not (Test-Path -LiteralPath $robocopy)) {
        Write-Error "robocopy.exe not found at $robocopy"
    }

    $null = & $robocopy $UploadRoot $destMirror /MIR /R:2 /W:5 /NFL /NDL /NJH /NJS /NC /NS 2>&1
    $rc = $LASTEXITCODE
    if ($rc -ge 8) {
        Write-Error "robocopy failed with exit code $rc"
    }
    Write-Host "OK: mirrored uploads to $destMirror (robocopy exit $rc; codes 0-7 mean success)"
    exit 0
}

# --- Archive mode: timestamped folders (legacy) ---
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destDir = Join-Path $BackupRoot "backup-$stamp"
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

$previousBackup = Get-ChildItem -LiteralPath $BackupRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'backup-*' -and $_.FullName -ne $destDir } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$all = Get-ChildItem -LiteralPath $UploadRoot -File -Recurse -ErrorAction SilentlyContinue
$copied = 0
$skipped = 0

foreach ($src in $all) {
    $relative = $src.FullName.Substring($UploadRoot.Length).TrimStart('\','/')
    $sameAsPrevious = $false
    if ($previousBackup) {
        $prevPath = Join-Path $previousBackup.FullName $relative
        if (Test-Path -LiteralPath $prevPath) {
            $prev = Get-Item -LiteralPath $prevPath
            $sameAsPrevious = ($prev.Length -eq $src.Length -and $prev.LastWriteTimeUtc -eq $src.LastWriteTimeUtc)
        }
    }
    if ($sameAsPrevious) {
        $skipped++
        continue
    }

    $destPath = Join-Path $destDir $relative
    $destParent = Split-Path -Parent $destPath
    if (-not (Test-Path -LiteralPath $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    Copy-Item -LiteralPath $src.FullName -Destination $destPath -Force
    $copied++
}

if ($copied -lt 1) {
    Write-Host "OK: no new/changed photo files to back up (scanned $($all.Count), skipped $skipped)"
} else {
    Write-Host "OK: backed up photos to $destDir ($copied copied, $skipped skipped, scanned $($all.Count))"
}

if ($KeepDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$KeepDays)
    Get-ChildItem -LiteralPath $BackupRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'backup-*' -and $_.LastWriteTime -lt $cutoff } |
        ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
}

<#
--- Register a daily backup (run PowerShell as your user, once) - mirror mode (default) ---

$repo = 'C:\temp\Mobile_Garage'
$script = Join-Path $repo 'scripts\backup-photos-to-drive.ps1'
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
$trigger = New-ScheduledTaskTrigger -Daily -At 2:45AM
Register-ScheduledTask -TaskName 'MobileGarage Photo backup' -Action $action -Trigger $trigger -Description 'Mirror uploads to Google Drive folder for sync'

One-liner:

$repo = 'C:\temp\Mobile_Garage'; $script = Join-Path $repo 'scripts\backup-photos-to-drive.ps1'; $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""; $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg; $trigger = New-ScheduledTaskTrigger -Daily -At 2:45AM; Register-ScheduledTask -TaskName 'MobileGarage Photo backup' -Action $action -Trigger $trigger -Description 'Mirror uploads to Google Drive folder for sync'

Archive mode (timestamped folders + KeepDays): add -ArchiveMode -KeepDays 30 to the script arguments.
#>
