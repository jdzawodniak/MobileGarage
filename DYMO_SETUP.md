## DYMO LabelWriter 450 Twin Turbo Setup

This project includes support for printing labels to a **DYMO LabelWriter 450 Twin Turbo** using **Python + COM** on Windows. This document explains how to set up the environment and how to run the included smoke-test script.

### 1. Platform and Python Requirements

- **OS**: Windows only. DYMO’s COM API is Windows‑only.
- **Python**: Use **Python 3.9+**, 64‑bit recommended.
- **Bitness must match DYMO**:
  - DYMO Label software is often **32‑bit**.
  - Python and DYMO must be the same bitness (both 32‑bit or both 64‑bit), or COM will fail to load.
  - To check Python bitness:

    ```bash
    python -c "import struct; print(struct.calcsize('P')*8, 'bit')"
    ```

### 2. DYMO Software

Install the official **DYMO Label** software and drivers for the LabelWriter 450 Twin Turbo from DYMO before using this integration. The COM objects used here (`Dymo.DymoAddIn`, `Dymo.DymoLabels`) are registered by that installer.

### 3. Python Virtual Environment

From the project root (`e:\VSCodeProjects\Mobile_Garage`), create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate
```

Keep using this `.venv` when working with DYMO printing.

### 4. Dependencies

Install the Python dependencies (including **pywin32**, which provides COM support on Windows):

```bash
pip install -r requirements.txt
```

Ensure that `pywin32` stays listed in `requirements.txt` (or your chosen dependency file). It is only meaningful on Windows, but harmless to list globally.

### 5. Core DYMO Printing Module

The project contains a core DYMO printing module based on a known‑good sample:

- Reference implementation (sandbox): `dymotest/src/dymo_twin_turbo.py`
- Main app integration: `src/mobile_garage/printing/dymo_twin_turbo.py` (and wrapper APIs in the same package)

Key behaviors:

- On **non‑Windows platforms**, importing the module will raise a `RuntimeError` stating that the DYMO COM API is Windows‑only.
- If **pywin32** is missing, an `ImportError` is raised with installation instructions.
- COM objects are created via:
  - `win32com.client.Dispatch("Dymo.DymoAddIn")`
  - `win32com.client.Dispatch("Dymo.DymoLabels")`
- Failures to create or use the COM objects raise a custom `DymoTwinTurboError` with hints about common issues (e.g. 32‑ vs 64‑bit mismatch).

The main functions exposed by the core module are:

- `print_label(label_path, roll, fields, copies, show_dialog, printer_name=None)`
- `print_to_both_rolls(label_path, fields_left, fields_right, copies_per_roll, show_dialog, printer_names=None)`

These are thin wrappers over the DYMO COM API and are used by higher‑level application functions.

### 6. Label File Requirements

You must provide a `.label` file created with the **DYMO Label** software. The file should:

- Target the **LabelWriter 450 Twin Turbo**.
- Contain one or more **variable text objects** with `IsVariable="True"`.
- Use `Name` attributes for those variable objects (e.g. `field1`, `field2`), which must **match exactly** the field names used in code.

The application‑level wrapper (for example, `print_shipping_label`) maps business data to these field names and then calls `print_label` under the hood.

### 7. Configuration (Label Path, Printer Names, Dialog)

DYMO behavior is configured via environment variables (read by the app’s DYMO config module):

- `DYMO_LABEL_PATH` – absolute or relative path to the `.label` file.
- `DYMO_PRINTER_LEFT` – optional override for the **left** roll printer queue name.
- `DYMO_PRINTER_RIGHT` – optional override for the **right** roll printer queue name.
- `DYMO_SHOW_DIALOG` – if set to `1` / `true` / `True`, the DYMO print dialog will be shown.

Defaults:

- If `DYMO_PRINTER_LEFT` / `DYMO_PRINTER_RIGHT` are not set, the code uses:
  - `"DYMO LabelWriter 450 Twin Turbo"` for both rolls.
- If `DYMO_SHOW_DIALOG` is not set, printing happens **silently** (`show_dialog=False`).

You can also configure these values via your own settings module if preferred; the core printing module accepts explicit label paths and printer names so it can be wired into any configuration system.

### 8. Example Smoke Test Script

There is a small example script that exercises DYMO printing from this project. It mirrors the working sample in `dymotest/examples/print_both_rolls.py` but imports from the main application package.

Usage (from project root, with venv activated):

```bash
python -m examples.print_both_rolls left
python -m examples.print_both_rolls right
python -m examples.print_both_rolls both
```

Behavior:

- `left` – prints one label on the **left** roll.
- `right` – prints one label on the **right** roll.
- `both` – prints one label on each roll, using different text on each side.

Before running:

1. Set `DYMO_LABEL_PATH` to point at your `.label` file:

   **Command Prompt (cmd):**
   ```cmd
   set DYMO_LABEL_PATH=E:\TestLabel2.label
   ```

   **PowerShell:**
   ```powershell
   $env:DYMO_LABEL_PATH = "E:\TestLabel2.label"
   ```

2. (Optional) If your printer queues have custom names (e.g. “DYMO Left” / “DYMO Right”), set:

   **Command Prompt (cmd):**
   ```cmd
   set DYMO_PRINTER_LEFT=DYMO Left
   set DYMO_PRINTER_RIGHT=DYMO Right
   ```

   **PowerShell:**
   ```powershell
   $env:DYMO_PRINTER_LEFT = "DYMO Left"
   $env:DYMO_PRINTER_RIGHT = "DYMO Right"
   ```

3. Run one of the commands above and confirm a label prints as expected.

If an error occurs, the script will print a clear message to stdout, including `DymoTwinTurboError` details where available.

### 9. Print Service (Add Item → Label)

When you **add an item** (web or app), the server enqueues a small label job. The **print-service** (Node) polls for pending jobs and can send them to the DYMO using the same Python COM path you tested.

To use the Python DYMO path from the print-service:

1. Set in your environment (or `.env` in the print-service directory):
   - `DYMO_USE_PYTHON=1`
   - `DYMO_LABEL_PATH` or `DYMO_LABEL_TEMPLATE` = full path to your `.label` file (e.g. `E:\TestLabel2.label`)
   - `MOBILE_GARAGE_ROOT` = project root (e.g. `E:\VSCodeProjects\Mobile_Garage`). Omit if you start the print-service from the project root.
   - `DYMO_PYTHON_PATH` = path to the Python that has `mobile_garage` and pywin32 (e.g. `E:\VSCodeProjects\Mobile_Garage\.venv\Scripts\python.exe`). Omit to use `python` from PATH.

2. Start the print-service from the project root (or set `MOBILE_GARAGE_ROOT`), and ensure the server is running so the service can fetch pending jobs.

3. Add an item (left/right/both roll); the service will call `python -m mobile_garage.cli.print_item_label` with the item name and location. The label uses **field1** = item name, **field2** = location code.

**If it doesn’t print:**

- Check the **print-service** console when you add an item. You should see either `[PRINT] Sending job N via Python DYMO` or an error.
- On startup with `DYMO_USE_PYTHON=1` you should see: `Python DYMO active. MOBILE_GARAGE_ROOT=... | src/mobile_garage exists: true | label: E:\...\Your.label`. If `src/mobile_garage exists: false`, set `MOBILE_GARAGE_ROOT` to the project root (e.g. `E:\VSCodeProjects\Mobile_Garage`) or start the print-service from the project root (`node print-service/src/index.js`).
- Ensure **server** is running and **API_URL** in print-service points to it (default `http://localhost:3011`).
- Run the CLI by hand to see the real error:
  ```powershell
  cd E:\VSCodeProjects\Mobile_Garage
  $env:DYMO_LABEL_PATH = "E:\TestLabel2.label"
  $env:PYTHONPATH = "src"
  .\.venv\Scripts\python.exe -m mobile_garage.cli.print_item_label --name "Test" --location "A-01" --roll left
  ```
  Any Python or DYMO error will appear in the terminal.

### 10. Known‑Good Sandbox (dymotest)

The `dymotest/` directory contains the original, isolated DYMO test project that was used to verify printing to both rolls:

- Core module: `dymotest/src/dymo_twin_turbo.py`
- Example script: `dymotest/examples/print_both_rolls.py`
- Sample label: `dymotest/TestLabel2.label`

If needed, you can activate the virtual environment in `dymotest/.venv` and use that project as a standalone reference to confirm that the printer, drivers, and COM registration are working outside of the main application.

