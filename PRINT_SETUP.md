# Label Print Service – Setup Instructions

The print service runs on the **Windows PC** where your two label printers are connected. It polls the inventory server for pending print jobs and sends them to the correct printer (large labels for storage areas, small labels for items).

---

## 1. Prerequisites

- **Node.js** (v18 or later) installed on the Windows PC. Check with: `node -v`
- **Both label printers** installed and working in Windows (test print from Notepad or Settings).
- The **inventory server** running and reachable (e.g. `http://192.168.87.20:3011` from this PC or from your network).

**For the DYMO SDK path (recommended for LabelWriter Twin Turbo):** Install **DYMO Label v8.2+** or **DLS 7** on the Windows PC. This registers the COM library used by the DymoPrint CLI so small labels and “Test connection (left)” work without the Windows print dialog or WMI.

---

## 2. Using the DYMO SDK (recommended for Twin Turbo)

When **DYMO_CLI_PATH** and **DYMO_LABEL_TEMPLATE** are set in `.env`, the print service uses the official DYMO DLS COM API for **small (item) labels** and **Test connection (left)**. This avoids the Windows print dialog and WMI, and gives reliable left/right/both roll selection.

### 2.1 Install DYMO Label or DLS

Install **DYMO Label v8.2+** or **DLS 7** on the Windows PC where the printers are attached. This registers the COM components (`Dymo.DymoAddIn`, `Dymo.DymoLabels`) required by the CLI.

### 2.2 Build the DymoPrint CLI

1. Open the project folder `print-service\dymo-print-cli` in Visual Studio (or use MSBuild from a Developer Command Prompt).
2. Set the solution platform to **x86** (the DYMO COM library is 32-bit).
3. Build in Release (or Debug). The output is `bin\Release\DymoPrint.exe` (or `bin\Debug\DymoPrint.exe`).
4. Copy **DymoPrint.exe** into `print-service\bin\` (create the `bin` folder if it doesn’t exist), or put it anywhere and set **DYMO_CLI_PATH** in `.env` to the full path of the exe.

See `print-service\dymo-print-cli\README.md` for command-line build instructions.

### 2.3 Create a label template

The CLI needs a **.label or .LWL** file that defines the layout and **object names** for the item label.

1. Open **DYMO Label** software.
2. Create a new label (or open an existing one) that fits your small (item) labels.
3. Add **text objects** and give them names that you will use in `.env`. The print service expects two objects by default:
   - **ItemName** – item name (e.g. “Widget A”).
   - **Location** – return location code (e.g. “RS-Rack-A-1”).
4. Save the label (e.g. as `item.label`) in a folder that won’t be moved (e.g. `C:\Labels\item.label` or inside `print-service\labels\`).
5. In `.env`, set **DYMO_LABEL_TEMPLATE** to the full path of this file (e.g. `DYMO_LABEL_TEMPLATE=C:\Labels\item.label`).

If your template uses different object names, set **DYMO_OBJNAME_ITEM** and **DYMO_OBJNAME_LOCATION** in `.env` to match (e.g. `DYMO_OBJNAME_ITEM=Title`, `DYMO_OBJNAME_LOCATION=ReturnTo`).

**Test connection (left):** The service prints a test label using the same template with fixed text (“Test” / “Connection OK”) unless you set **DYMO_TEST_LABEL_TEMPLATE** to a different file.

### 2.4 Configure .env for the SDK path

In `print-service\.env` add (or uncomment and set):

```env
DYMO_CLI_PATH=bin\DymoPrint.exe
DYMO_LABEL_TEMPLATE=C:\path\to\your\item.label
```

If you use different object names in your template:

```env
DYMO_OBJNAME_ITEM=ItemName
DYMO_OBJNAME_LOCATION=Location
```

Restart the print service. Small labels and “Test connection (left)” will then use the DymoPrint CLI and DLS COM. Large labels continue to use the existing PrintTo path to **LARGE_PRINTER**.

---

## 3. Find the exact printer names in Windows

The service uses the **exact** names Windows uses for each printer.

1. Open **Settings** (Win + I).
2. Go to **Bluetooth & devices** → **Printers & scanners**.
3. Under “Printers & scanners”, note the **exact name** of each printer (e.g. `DYMO LabelWriter 450`, `Brother QL-800`).
4. Alternatively, open **Control Panel** → **Devices and Printers** and read the name under each printer icon.

Write them down:
- **Large label printer name:** _________________
- **Small label printer name:** _________________

**DYMO LabelWriter 450 Twin Turbo:** Windows exposes it as **two** logical printers (one USB device, two print queues). Use these exact names in `.env` so the Add Item screen can target left roll, right roll, or both:
- **Left:** `DYMO LabelWriter 450 Twin Turbo (Left)`
- **Right:** `DYMO LabelWriter 450 Twin Turbo (Right)`

Set both `SMALL_PRINTER_LEFT` and `SMALL_PRINTER_RIGHT` in `.env` to those values; the service will use them when you choose “Left roll”, “Right roll”, or “Both rolls” when adding an item.

If the name has spaces or special characters, you still enter it as-is in `.env` (no extra quotes in the file).

---

## 4. Install and configure the print service

### 4.1 Copy the project (if needed)

If the Mobile_Garage project is only on another machine, copy the whole project folder (or at least the `print-service` folder) to the Windows PC where the printers are attached.

### 4.2 Open a terminal on the Windows PC

- Open **Command Prompt** or **PowerShell**.
- Go to the print service folder:
  ```cmd
  cd path\to\Mobile_Garage\print-service
  ```
  (Replace with the real path, e.g. `cd E:\VSCodeProjects\Mobile_Garage\print-service`.)

### 4.3 Install dependencies

```cmd
npm install
```

### 4.4 Create your config file

1. In the `print-service` folder, copy the example env file:
   - Copy `.env.example` to a new file named `.env`.
   - On Windows: `copy .env.example .env`
2. Open `.env` in Notepad (or any editor) and set the values.

**If the inventory server runs on this same PC:**

```env
API_URL=http://localhost:3011
LARGE_PRINTER=Your Large Printer Name Here
SMALL_PRINTER=Your Small Printer Name Here
```

**If the inventory server runs on another PC (e.g. 192.168.87.20):**

```env
API_URL=http://192.168.87.20:3011
LARGE_PRINTER=Your Large Printer Name Here
SMALL_PRINTER=Your Small Printer Name Here
```

Replace `Your Large Printer Name Here` and `Your Small Printer Name Here` with the exact names from step 2. If a name has spaces, keep the quotes:

```env
LARGE_PRINTER=DYMO LabelWriter 450
SMALL_PRINTER=Brother QL-800
```

Save the file.

**Optional:** If your server uses an API key, add:

```env
API_KEY=your-secret-api-key
```

The service loads `.env` automatically when you run `npm start`, so you do not need to set these variables in the terminal.

---

## 5. Run the print service

From the `print-service` folder:

```cmd
npm start
```

You should see something like:

```
Print service started. Polling http://192.168.87.20:3011 every 5000 ms
```

- If **LARGE_PRINTER** and **SMALL_PRINTER** are set: the service will fetch pending jobs and send them to the correct printer.
- If they are **not** set: you will see `LARGE_PRINTER / SMALL_PRINTER not set – dry-run mode (jobs logged only)` and each job will be printed to the **console** only (no physical print). Use this to confirm the server connection before configuring printers.

Leave this window open while you want labels to print. Closing it stops the service.

---

## 6. Verify setup

1. **Check pending jobs on the server**  
   In a browser or with curl:
   ```text
   http://192.168.87.20:3011/api/print-jobs?status=pending
   ```
   You should see any jobs that haven’t been printed yet (e.g. the “Pen” item).

2. **Add a test item**  
   Use the phone or web UI to add an item. A small-label job should appear in the queue.

3. **Watch the print service window**  
   - In dry-run: you should see `[DRY-RUN] Would print to small printer:` and the label text.
   - With printers set: the job should be sent to the small label printer and the job should disappear from the pending list (or show as completed depending on your API).

4. **Create a storage unit**  
   Create a new storage unit from the web UI. A large-label job should be created and, if printers are configured, printed on the large label printer.

---

## 7. Troubleshooting

| Problem | What to check |
|--------|----------------|
| “Poll error: fetch failed” / connection errors | Server not running, or wrong **API_URL** (wrong IP, or missing `:3011`). From this PC, open `http://API_URL/api/health` in a browser and confirm you see `{"ok":true,"db":"connected"}`. |
| “Print error” / job not printing | Printer name must match Windows **exactly** (case, spaces, parentheses). In Command Prompt run `wmic printer get name` and copy the names into `.env`. |
| Left/Right/Both – nothing prints | The print service logs `[PRINT] Sending job X to left roll: "…"`. If that name does not match `wmic printer get name`, printing fails. Some PCs show the left roll as **DYMO LabelWriter 450 Twin Turbo** (no "(Left)"); if so, set **SMALL_PRINTER_LEFT** to that exact string and **SMALL_PRINTER_RIGHT** to the line that has "(Right)". |
| Job stays “pending” | Print service not running, or not reaching the server. Restart the service and watch the console for errors. |
| Wrong printer used | **Large** jobs go to **LARGE_PRINTER**, **small** (item) jobs to **SMALL_PRINTER** / **SMALL_PRINTER_LEFT** / **SMALL_PRINTER_RIGHT**. Match `.env` to your intended printer names. |
| Firewall | If the server is on another PC, ensure port **3011** is allowed for inbound TCP on that PC. |
| DYMO CLI fails / “COM not available” | Install DYMO Label v8.2+ or DLS 7. Ensure **DymoPrint.exe** was built as **x86**. Set **DYMO_CLI_PATH** to the full path of the exe and **DYMO_LABEL_TEMPLATE** to a valid .label path. |

---

## 8. Running the service in the background

To keep it running after you close the terminal:

- **Option A:** Run it in a separate Command Prompt or PowerShell window and leave that window open.
- **Option B:** Use **NSSM** or **pm2-windows-service** to run `node src/index.js` (or `npm start`) as a Windows service so it starts with the PC and keeps running.

---

## Summary

1. Get the exact **printer names** from Windows (Settings → Printers & scanners).
2. **(Recommended for Twin Turbo)** Install DYMO Label v8.2+ or DLS 7, build **DymoPrint.exe** (x86), create a small item label template with objects **ItemName** and **Location**, and set **DYMO_CLI_PATH** and **DYMO_LABEL_TEMPLATE** in `.env`.
3. In **print-service**, run `npm install`.
4. Copy `.env.example` to `.env`, edit it, and set **API_URL**, **LARGE_PRINTER**, and **SMALL_PRINTER** (and DYMO_* if using the SDK path).
5. Run **npm start** and leave the window open.
6. Add an item or storage unit and confirm the correct label prints (or appears in dry-run output).
