# Mobile Garage – complete installation guide

This document is the **full, ordered setup** for a new machine. It covers the inventory **server** (Node + SQLite + web UI), the **Windows print service**, optional **Android** build, and verification.

**Related docs**

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Overview, API summary, Google Drive backups, restore |
| [DYMO_SETUP.md](DYMO_SETUP.md) | DYMO LabelWriter, Python COM, label `.label` files |
| [PRINT_SETUP.md](PRINT_SETUP.md) | Print service, DymoPrint CLI, printer names |
| [PUSH_TO_GITHUB.md](PUSH_TO_GITHUB.md) | Publishing the repo |

---

## 1. Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Windows 10 or 11** | Required for the print service and DYMO COM integration. The **server** can run on Windows or elsewhere; this guide assumes everything on one Windows PC. |
| **Node.js 18+** (LTS recommended) | [https://nodejs.org](https://nodejs.org) — includes `npm`. Verify: `node -v` and `npm -v`. |
| **Python 3.11–3.13** | On PATH for `install-requirements.ps1`. The **`dymotest`** venv avoids Python **3.14+** (pinned wheels). Use the **py** launcher if you have multiple versions. |
| **Git** | To clone the repository. |
| **DYMO Label** (or compatible DLS) | For Twin Turbo / COM printing — see [DYMO_SETUP.md](DYMO_SETUP.md). |
| **Android Studio** (optional) | Only if you build the Android app yourself. |

**Execution policy (PowerShell scripts)**  
If `.\install-requirements.ps1` is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
```

---

## 2. Get the code

```powershell
cd C:\path\where\you\keep\repos
git clone https://github.com/YOUR_USERNAME/MobileGarage.git
cd MobileGarage
```

Use your real clone URL. Ensure `.env` files are **not** committed (they stay local; use `.env.example` files).

---

## 3. Install dependencies (recommended: automated script)

From the **repository root** in PowerShell:

```powershell
Set-Location C:\path\to\MobileGarage
.\install-requirements.ps1
```

### What the script does

1. **`npm install`** at the **repo root** — installs `concurrently` (used by `npm start`).
2. **`server/`** — `npm install`, **`npm rebuild better-sqlite3`** (must match your Node version), then **`npm run db:migrate`** to create `server/data/inventory.db` and schema.
3. **`print-service/`** — `npm install`.
4. **Python** — `pip install -r requirements.txt` (root `requirements.txt`, e.g. **pywin32** for COM tooling on Windows).
5. **`dymotest/`** (optional) — creates a `.venv` with pinned deps for DYMO experiments; prefers Python 3.12/3.13 via `py -3.12` when available.

### Script options

| Switch | Effect |
|--------|--------|
| `-SkipPython` | Skip all `pip` / `dymotest` steps. |
| `-SkipDymotest` | Skip only the `dymotest` virtualenv. |
| `-SkipDbMigrate` | Skip `npm run db:migrate` (only if you manage the DB yourself). |

---

## 4. Manual install (if you skip the script)

Run these from a terminal, in order.

**Repository root**

```powershell
npm install
```

**Server**

```powershell
cd server
npm install
npm rebuild better-sqlite3
npm run db:migrate
cd ..
```

**Print service**

```powershell
cd print-service
npm install
cd ..
```

**Python (Windows, for DYMO / pywin32)**

```powershell
py -3.12 -m pip install --upgrade pip
py -3.12 -m pip install -r requirements.txt
```

(Use `python` instead of `py` if you do not have the launcher.)

---

## 5. Configuration files

### 5.1 Server — `server/.env`

1. Copy the example file:

   ```powershell
   copy server\.env.example server\.env
   ```

2. Edit `server\.env`. Typical variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default **3011**). |
| `DB_PATH` | SQLite file (default `./data/inventory.db` relative to `server/`). |
| `UPLOAD_DIR` | Item photos directory (default `./uploads`). Must match backup scripts if you change it. |
| `API_KEY` | Optional. If set to a non-placeholder value, clients must send this key (see print-service). Leave default during local-only dev if you want open API. |

### 5.2 Print service — `print-service/.env`

1. Copy the example file:

   ```powershell
   copy print-service\.env.example print-service\.env
   ```

2. Edit `print-service\.env`. Minimum concepts:

| Variable | Purpose |
|----------|---------|
| `API_URL` | Base URL of the inventory server **with port**, no trailing slash, e.g. `http://127.0.0.1:3011` on the same PC or `http://192.168.x.x:3011` if the server is on another machine. |
| `API_KEY` | Must match `server` `API_KEY` if you enabled authentication on the server. |
| `LARGE_PRINTER` / `SMALL_PRINTER` | Exact Windows printer names (Settings → Printers & scanners). |
| `DYMO_LABEL_PATH` | Path to your small (item) **`.label`** template — see [DYMO_SETUP.md](DYMO_SETUP.md). |
| `DYMO_LARGE_LABEL_PATH` or template env | Large (storage) label — see [PRINT_SETUP.md](PRINT_SETUP.md). |

**SDK / CLI path:** Alternatively configure `DYMO_CLI_PATH` and `DYMO_LABEL_TEMPLATE` per [PRINT_SETUP.md](PRINT_SETUP.md).

---

## 6. DYMO, templates, and printers

1. Install **DYMO Label** (or DLS) and drivers so COM objects are registered.
2. Create **`.label`** files with the **object names** your `.env` expects (e.g. `field1`, `field2` for the Python path — see examples in [DYMO_SETUP.md](DYMO_SETUP.md) and [print-service/.env.example](print-service/.env.example)).
3. Set printer names in `.env` to match Windows **exactly**.

Details: **[DYMO_SETUP.md](DYMO_SETUP.md)** and **[PRINT_SETUP.md](PRINT_SETUP.md)**.

---

## 7. Start the application

**Option A — batch file (Windows)**

Double-click **`start_mobile_garage.bat`** in the repo root, or from `cmd`:

```bat
start_mobile_garage.bat
```

**Option B — npm (repo root)**

```powershell
npm start
```

This runs **both**:

- **Inventory server** — `server` with `npm run dev` (Node `--watch`). Listens on **0.0.0.0:PORT** (default **3011**): web UI + `/api/*`.
- **Print service** — polls `API_URL` for pending label jobs.

Stop with **Ctrl+C** in that terminal.

---

## 8. Windows Firewall (LAN phones / other PCs)

To use the web UI or Android app from another device:

1. Allow inbound **TCP** on port **3011** (or your `PORT`) for **Node.js** / **Private** networks.
2. Use the host PC’s **LAN IP** (e.g. `http://192.168.1.50:3011`).

---

## 9. Verify installation

1. **Health**

   ```powershell
   curl http://127.0.0.1:3011/api/health
   ```

   Expect JSON like `{ "ok": true, "db": "connected" }`.

2. **Web UI** — Open `http://localhost:3011` in a browser.

3. **Flow test** — Add Storage → Add Item (optional photo). Confirm the print service picks up jobs (check its console output).

---

## 10. Android app

1. Install **Android Studio**, open the **`android/`** folder as a project.
2. Sync Gradle; build with **Run** or:

   ```powershell
   cd android
   .\gradlew assembleDebug
   ```

3. **Server address** — In `RetrofitClient.kt`, set `DEFAULT_BASE_URL` (or your in-app setting) to your PC’s API base, e.g. `http://192.168.x.x:3011/api/`.  
   - **Emulator:** often `http://10.0.2.2:3011/api/` reaches the host machine.

4. **HTTP** — The app manifest enables **`usesCleartextTraffic`** for local HTTP; use HTTPS in production if exposed beyond the LAN.

---

## 11. Web UI: webcam on PC

**Use webcam** uses the browser camera API. It works on **`http://localhost`** or **HTTPS**. Plain **`http://` to a LAN IP** may block the camera in Chrome/Edge; use **Choose file** in that case, or put the UI behind HTTPS.

---

## 12. Photo uploads (server)

The server accepts images from phones and browsers, normalizes them (resize, JPEG) using **sharp** and optional **HEIC** decoding. Dependencies are installed with **`cd server && npm install`**. No extra manual step beyond the install script.

---

## 13. Optional: backups

After the app runs, schedule **Google Drive** (or other) backups:

- Database: **`scripts/backup-db-to-drive.ps1`**
- Photos: **`scripts/backup-photos-to-drive.ps1`**

See **[README.md](README.md)** for env vars, scheduled task examples, and restore steps.

---

## 14. Updating after `git pull`

```powershell
.\install-requirements.ps1 -SkipDbMigrate
```

Or at minimum:

```powershell
npm install
cd server; npm install; npm rebuild better-sqlite3; cd ..
cd print-service; npm install; cd ..
```

Run **`npm run db:migrate`** in `server` again if migrations were added.

---

## 15. Troubleshooting

| Issue | What to try |
|-------|-------------|
| **`EADDRINUSE` on 3011** | Another process uses the port; stop it or change `PORT` in `server/.env`. |
| **`better-sqlite3` errors after Node upgrade** | `cd server && npm rebuild better-sqlite3` |
| **Print service `Poll error` / `fetch failed`** | Server not running yet, wrong `API_URL`, or firewall blocking loopback/LAN. |
| **DYMO / COM errors** | Match Python **32- vs 64-bit** with DYMO; see [DYMO_SETUP.md](DYMO_SETUP.md). |
| **`dymotest` venv fails on Python 3.14** | Use `-SkipDymotest` or install Python 3.12 and the **py** launcher; script prefers `-3.12`. |
| **Script cannot be loaded** | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

---

## 16. Checklist (copy/paste)

- [ ] Node.js and (optional) Python on PATH  
- [ ] `git clone` …  
- [ ] `.\install-requirements.ps1`  
- [ ] `server\.env` from `.env.example`  
- [ ] `print-service\.env` from `.env.example` (`API_URL`, printers, DYMO paths)  
- [ ] DYMO software + `.label` templates configured  
- [ ] `npm start` or `start_mobile_garage.bat`  
- [ ] `http://localhost:3011` and `/api/health` OK  
- [ ] Firewall if using phones on LAN  
- [ ] (Optional) Android `DEFAULT_BASE_URL`  
- [ ] (Optional) Scheduled backup tasks  

When this checklist is green, installation is complete.
