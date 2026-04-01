# Mobile Garage Inventory

Replacement for SmartSuite-based shop inventory: Android app, Node backend, SQLite, and automatic label printing (DYMO LabelWriter 450 Twin Turbo on Windows).

## Repository and backup

This project is a Git repo (branch `main`). To back it up to your **MobileGarage** remote:

```bash
git remote add origin https://github.com/YOUR_USERNAME/MobileGarage.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub (or Git host) username. If the repo is empty, the push will create the branch and upload all files. `.env` files and `node_modules`/`.venv` are gitignored.

- **Docs:** [DYMO_SETUP.md](DYMO_SETUP.md) – DYMO printer setup, Python COM, and print-service config.
- **Backups (Windows):** [scripts/backup-db-to-drive.ps1](scripts/backup-db-to-drive.ps1) (SQLite) and [scripts/backup-photos-to-drive.ps1](scripts/backup-photos-to-drive.ps1) (uploads). See sections below.

## Google Drive backups at a glance

| What | Script | Default destination (under your Google Drive sync) | Suggested task name | Suggested time |
|------|--------|----------------------------------------------------|---------------------|----------------|
| SQLite database | `scripts/backup-db-to-drive.ps1` | `...\MobileGarage\db-backups\backup-*` | `MobileGarage DB backup` | e.g. 2:15 AM |
| Item photos | `scripts/backup-photos-to-drive.ps1` | `...\MobileGarage\photos-backups\current` (single mirror) | `MobileGarage Photo backup` | e.g. 2:45 AM (after DB) |

Environment variables:

- `MOBILE_GARAGE_BACKUP_ROOT` – overrides where **database** timestamped folders are created.
- `MOBILE_GARAGE_PHOTO_BACKUP_ROOT` – overrides the **photo backup root** (default: sibling `photos-backups`; files are mirrored into `...\photos-backups\current`).
- `UPLOAD_DIR` – if you moved uploads off the default `server/uploads`, the photo backup script reads this (must match the server).

**One-shot scheduled task registration** (paste in PowerShell; change `$repo` if needed):

Database:

```powershell
$repo = 'C:\temp\Mobile_Garage'; $script = Join-Path $repo 'scripts\backup-db-to-drive.ps1'; $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -KeepDays 30"; $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg; $trigger = New-ScheduledTaskTrigger -Daily -At 2:15AM; Register-ScheduledTask -TaskName 'MobileGarage DB backup' -Action $action -Trigger $trigger -Description 'Copy SQLite DB to Google Drive folder for sync'
```

Photos (single mirror folder; no `-KeepDays` needed):

```powershell
$repo = 'C:\temp\Mobile_Garage'; $script = Join-Path $repo 'scripts\backup-photos-to-drive.ps1'; $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""; $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg; $trigger = New-ScheduledTaskTrigger -Daily -At 2:45AM; Register-ScheduledTask -TaskName 'MobileGarage Photo backup' -Action $action -Trigger $trigger -Description 'Mirror uploads to Google Drive for sync'
```

Check status: `Get-ScheduledTask -TaskName 'MobileGarage*'`. Remove a task: `Unregister-ScheduledTask -TaskName 'MobileGarage Photo backup' -Confirm:$false`.

## Automatic DB backup (Google Drive, set-and-forget)

The SQLite DB is local by default at `server/data/inventory.db`. This repo includes
`scripts/backup-db-to-drive.ps1` to copy the DB into Google Drive on a schedule.

### One-time setup

From PowerShell:

```powershell
$repo = 'C:\temp\Mobile_Garage'
$script = Join-Path $repo 'scripts\backup-db-to-drive.ps1'
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -KeepDays 30"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
$trigger = New-ScheduledTaskTrigger -Daily -At 2:15AM
Register-ScheduledTask -TaskName 'MobileGarage DB backup' -Action $action -Trigger $trigger -Description 'Copy SQLite DB to Google Drive folder for sync'
```

### Manual test

```powershell
cd C:\temp\Mobile_Garage
.\scripts\backup-db-to-drive.ps1
```

Expected output:

```text
OK: backed up to ...\Google Drive\MobileGarage\db-backups\backup-YYYYMMDD-HHmmss (N file(s))
```

### Backup location and retention

- Default backup root is auto-detected from common Google Drive paths.
- Override with env var `MOBILE_GARAGE_BACKUP_ROOT` if your Drive path differs.
- `-KeepDays 30` keeps last 30 days of `backup-*` folders (set `-KeepDays 0` to disable pruning).

### Restore process

1. Stop Mobile Garage (`npm start` terminal, Ctrl+C).
2. Pick a backup folder from Google Drive (`backup-YYYYMMDD-HHmmss`).
3. Copy `inventory.db` back to `server/data/inventory.db`.
4. If the backup folder also has `inventory.db-wal` and `inventory.db-shm`, copy those too.
5. Start app again with `npm start`.

Tip: keep the live DB local and use Google Drive as backup destination (recommended for SQLite reliability).

## Photo storage, compression, and backup

Uploaded item photos are **files on disk**, not blobs inside SQLite. The database only stores `photo_path` (a relative path). Files live under `server/uploads` (or `UPLOAD_DIR` if set).

On upload, the server normalizes images with **sharp** (installed with the server’s `npm install`):

- **JPEG output**
- **max 800px on the longest side** (no upscaling)
- **quality 65**

Unsupported or corrupt uploads return `400` with `Invalid or unsupported image format`. The API still returns `{ path, url }` on success; paths end in `.jpg` after processing.

### Automatic photo backup (Google Drive, daily)

By default, `scripts/backup-photos-to-drive.ps1` **mirrors** `server/uploads` into a **single folder**:

`...\MobileGarage\photos-backups\current`

It uses Windows **robocopy /MIR**: each run updates changed files and only keeps **one copy** of each image (no growing set of daily full folders). If you delete a photo from `server/uploads`, the next run removes it from `current` as well (true mirror).

From PowerShell (multi-line):

```powershell
$repo = 'C:\temp\Mobile_Garage'
$script = Join-Path $repo 'scripts\backup-photos-to-drive.ps1'
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
$trigger = New-ScheduledTaskTrigger -Daily -At 2:45AM
Register-ScheduledTask -TaskName 'MobileGarage Photo backup' -Action $action -Trigger $trigger -Description 'Mirror uploads to Google Drive for sync'
```

**Legacy timestamped backups** (optional): run with `-ArchiveMode` (and `-KeepDays 30` to prune old `backup-*` folders).

Manual test:

```powershell
cd C:\temp\Mobile_Garage
.\scripts\backup-photos-to-drive.ps1
```

Expected output:

```text
OK: mirrored uploads to ...\photos-backups\current (robocopy exit N; codes 0-7 mean success)
```

Notes:
- Default photo backup root is the **same Drive root as DB backups**, with a sibling folder **`photos-backups`** (not inside `db-backups`).
- Override with `MOBILE_GARAGE_PHOTO_BACKUP_ROOT` if needed.
- Stagger photo backup **after** the DB task (e.g. 2:15 DB, 2:45 photos) to avoid heavy disk I/O at once.
- If you already registered a task with `-KeepDays 30`, you can leave it; extra args are harmless in mirror mode, or update the task to match the one-liner above.

### Photo restore process

1. Stop Mobile Garage (`npm start` terminal, Ctrl+C).
2. From Google Drive open `photos-backups\current` (mirror) or a legacy `photos-backups\backup-*` folder if you used `-ArchiveMode`.
3. Copy its contents back into `server/uploads` (preserve subfolders).
4. Start app again with `npm start`.

## Running the environment (Windows batch launcher)

You can launch the full environment from the project root with:

```bat
start_mobile_garage.bat
```

This runs `npm run start` and starts:
- Inventory server (web UI + API)
- Print service

## Phase 1 – Environment & Core Functions

### Project structure

- **server/** – Node.js backend (Express, SQLite, image upload)
- **print-service/** – Windows print service (polls for jobs, drives label printers)
- **android/** – Android app (Kotlin, Jetpack Compose, CameraX)

### Quick start

**Start both server and print service (one command)**

From the project root:

```bash
npm install          # once: installs concurrently + server/print-service deps
cd server && npm install && npm run db:migrate   # once: DB setup
cd ..
npm start            # runs server + print service in one terminal
```

- Server: http://localhost:3011 (Web UI and API)
- Print service: polls for jobs and prints item labels via Python DYMO when `DYMO_LABEL_PATH` is set in `print-service/.env` (see [DYMO_SETUP.md](DYMO_SETUP.md))

### Settings menu (template navigation)

The Web UI now includes a **Settings** view where you can:
- See the resolved small and large label template paths
- See whether each template file exists
- Open Explorer directly to the small template file
- Open Explorer directly to the large template file
- Open Explorer to `print-service/.env`

Template env variables used by the app:
- `DYMO_LABEL_PATH` or `DYMO_LABEL_TEMPLATE` for small/item labels
- `DYMO_LARGE_LABEL_PATH` or `DYMO_LARGE_LABEL_TEMPLATE` for large/storage labels

**Or run separately**

**1. Backend (run on your dev machine or Hetzner server)**

```bash
cd server
npm install
npm run db:migrate   # creates data/inventory.db
npm run dev          # http://localhost:3011
```

- Web UI: http://localhost:3011  
- API: http://localhost:3011/api/

**2. Create a storage unit (via Web UI)**

- Go to "Add Storage"
- Building: RS or WS  
- Type: Rack, Cabinet, Bag  
- Identifier: A, B, C, D  
- Spaces: 1–24 (your choice)  
- Creates locations like `RS-Rack-A-1` … `RS-Rack-A-N` and queues a large label

**3. Add items**

- Use Web UI or Android app
- Name, location, optional photo
- Queues a small label for the item

**4. Windows print service**

```bash
cd print-service
npm install
# Set env vars (or create .env):
# API_URL=http://your-server:3011
# LARGE_PRINTER="Your Large Label Printer Name"
# SMALL_PRINTER="Your Small Label Printer Name"
npm start
```

Without `LARGE_PRINTER`/`SMALL_PRINTER`, jobs are logged only (dry-run).

**5. Android app**

```bash
cd android
./gradlew assembleDebug
# Install on device/emulator
```

- Emulator: server at `10.0.2.2:3011`  
- Physical device: set your PC’s LAN IP in the app (or via BuildConfig)

### API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/locations | List/search locations |
| GET | /api/locations/:id | Location detail + items |
| GET | /api/items | List/search items |
| POST | /api/items | Create item (queues small label) |
| POST | /api/storage-units | Create storage unit + spaces (queues large label) |
| POST | /api/photos | Upload image (stored under `server/uploads`, resized to JPEG ~800px q65) |
| GET | /api/print-jobs/pending | Pending print jobs (for print service) |
| POST | /api/print-jobs/reprint | Manual reprint |

### Next phases

- **Phase 2**: Speech-to-text for "add X to WS rack A space 5"
- **Phase 3**: Visual (image) search for similar items
