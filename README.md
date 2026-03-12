# Mobile Garage Inventory

Replacement for SmartSuite-based shop inventory: Android app, Node backend, SQLite, and automatic label printing (DYMO LabelWriter 450 Twin Turbo on Windows).

## Repository

- **Remote:** Add your Git remote and push:  
  `git remote add origin https://github.com/YOUR_USERNAME/MobileGarage.git`  
  then `git push -u origin main`.
- **Docs:** [DYMO_SETUP.md](DYMO_SETUP.md) – DYMO printer setup, Python COM, and print-service config.

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
| POST | /api/photos | Upload image |
| GET | /api/print-jobs/pending | Pending print jobs (for print service) |
| POST | /api/print-jobs/reprint | Manual reprint |

### Next phases

- **Phase 2**: Speech-to-text for "add X to WS rack A space 5"
- **Phase 3**: Visual (image) search for similar items
