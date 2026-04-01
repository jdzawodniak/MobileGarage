# DYMO LabelWriter 450 Twin Turbo – Test Environment

Print to **left** and **right** rolls of the DYMO LabelWriter 450 Twin Turbo from Python using the DYMO Label Framework COM API on Windows.

**Project install:** the main app setup is in **[../INSTALL.md](../INSTALL.md)**. The root **`install-requirements.ps1`** can create this folder’s **`.venv`** automatically. This README is for running **dymotest** examples in isolation.

## Setup

1. **Python**  
   Use Python 3.10+ (or any 3.x with pywin32 support).

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   This installs `pywin32` for COM access.

3. **DYMO Label software**  
   Install [DYMO Label software](https://www.dymo.com/support) so the COM API and printer drivers are available.

4. **Printer in Windows**  
   - Connect the LabelWriter 450 Twin Turbo.  
   - In **Devices & Printers**, you should see two printers (e.g. “DYMO LabelWriter 450 Twin Turbo Left” and “… Right”).  
   - If you only see one, you can [add a duplicate printer](https://mediaserver.newellrubbermaid.com/dls/DCDesktop/win/en/Content/Printing/LWTwinTurbo.htm) and assign one to the left roll and one to the right in the printer properties.

5. **Label file**  
   Create a label in DYMO Label software, add variable fields (e.g. `TEXT1`, `TEXT2`), and save as a `.label` file. Note the path for the examples.

## Project layout

```
dymotest/
├── requirements.txt
├── README.md
├── src/
│   ├── __init__.py
│   └── dymo_twin_turbo.py   # Left/right roll API
├── examples/
│   ├── print_both_rolls.py  # CLI: left | right | both
│   └── simple_com_example.py # Raw COM, single roll
└── tests/
    └── test_dymo_twin_turbo.py
```

## Usage

### 1. Module API (`src.dymo_twin_turbo`)

**Print to one roll (left or right):**

```python
from pathlib import Path
from src.dymo_twin_turbo import Roll, print_label

label_path = Path(r"C:\path\to\my.label")
print_label(
    label_path,
    Roll.LEFT,
    fields={"TEXT1": "Hello Left", "TEXT2": "2025-04-10"},
    copies=1,
    show_dialog=False,
)
```

**Print to both rolls (same label, different text):**

```python
from src.dymo_twin_turbo import print_to_both_rolls

print_to_both_rolls(
    label_path,
    fields_left={"TEXT1": "Left Roll", "TEXT2": "Date L"},
    fields_right={"TEXT1": "Right Roll", "TEXT2": "Date R"},
    copies_per_roll=1,
)
```

**Custom printer names** (if Windows shows different names):

```python
from src.dymo_twin_turbo import Roll, print_label

print_label(
    label_path,
    Roll.LEFT,
    fields={"TEXT1": "Hi"},
    printer_name="DYMO LabelWriter 450 Twin Turbo Left",  # exact name from Windows
)
```

### 2. Example script (both rolls)

1. In `examples/print_both_rolls.py`, set `LABEL_PATH` to your `.label` file and adjust `FIELD_MAIN` / `FIELD_DATE` to match your label’s variable fields.
2. Run from project root:

   ```bash
   # Left roll only
   python -m examples.print_both_rolls left

   # Right roll only
   python -m examples.print_both_rolls right

   # One label on left, one on right (different text)
   python -m examples.print_both_rolls both
   ```

### 3. Raw COM example

`examples/simple_com_example.py` is a minimal COM example (single roll). Set `LABEL_FILE` and `PRINTER_NAME` (“… Left” or “… Right”), then:

```bash
python examples/simple_com_example.py
```

## Printer names

The code assumes these default names:

- **Left:** `DYMO LabelWriter 450 Twin Turbo Left`
- **Right:** `DYMO LabelWriter 450 Twin Turbo Right`

If your system uses different names (e.g. localized or after adding a duplicate printer), pass `printer_name` to `print_label()` or `printer_names` to `print_to_both_rolls()`.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| `Invalid class string` / COM not available | DYMO Label is **32-bit**; use **32-bit Python** so COM can see it. Check with `python examples/check_dymo_com.py`. |
| `Dymo.DymoAddIn` / COM error | Install or repair DYMO Label software; use 32-bit Python if you see "Invalid class string". |
| `SelectPrinter` fails | In Windows “Devices and Printers”, note the exact printer names and pass them as `printer_name` / `printer_names`. |
| Only one printer shown | Add a second (duplicate) printer and assign one to left roll, one to right in printer properties. |
| Field names (TEXT1, etc.) | Must match the variable object names in your `.label` file (DYMO Label software). |

## Tests

```bash
pip install pytest
pytest tests/ -v
```

Tests that need a real `.label` file or printer are skipped unless the environment is set up accordingly.
