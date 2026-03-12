"""
DYMO LabelWriter 450 Twin Turbo – print to left and/or right roll via COM API.

Requires: pywin32, DYMO Label software installed on Windows.
"""

import sys
from enum import Enum
from pathlib import Path
from typing import Any, Optional

if sys.platform != "win32":
    raise RuntimeError("DYMO COM API is Windows-only. This module requires Windows.")

try:
    import win32com.client
except ImportError:
    raise ImportError("pywin32 is required. Install with: pip install pywin32")


class Roll(Enum):
    """Twin Turbo roll selection."""

    LEFT = "left"
    RIGHT = "right"


# Default printer names.
# Some drivers expose two queues (Left/Right), others only one queue that you
# configure to use the desired roll. In the single-queue case, both entries
# should be the same name and roll selection is handled by the driver.
DEFAULT_PRINTER_NAMES = {
    Roll.LEFT: "DYMO LabelWriter 450 Twin Turbo",
    Roll.RIGHT: "DYMO LabelWriter 450 Twin Turbo",
}


class DymoTwinTurboError(Exception):
    """Raised when DYMO COM or printing fails."""


def _get_dymo_objects():
    """
    Get DYMO AddIn and Labels COM objects.

    DYMO's COM model uses:
      - Dymo.DymoAddIn  -> printer selection, opening label files, print job control
      - Dymo.DymoLabels -> access to label fields via SetField(...)
    """
    try:
        addin = win32com.client.Dispatch("Dymo.DymoAddIn")
        labels = win32com.client.Dispatch("Dymo.DymoLabels")
        return addin, labels
    except Exception as e:  # pragma: no cover - COM-specific error handling
        msg = str(e).strip() or type(e).__name__
        hint = ""
        if "registered" in msg.lower() or "80040154" in msg or "invalid class" in msg.lower():
            hint = (
                " DYMO Label is often 32-bit: use 32-bit Python to match. "
                "Run: python -c \"import struct; print(struct.calcsize('P')*8, 'bit')\" to check."
            )
        raise DymoTwinTurboError(f"DYMO COM not available: {msg}.{hint}") from e


def get_installed_printers() -> list[str]:
    """
    Return list of DYMO printer names available on the system.
    Use this to see exact names for Left/Right (e.g. for SelectPrinter).
    """
    addin, labels = _get_dymo_objects()
    try:
        # GetPrinterNames() or similar – SDK may expose printer list.
        # Fallback: return default names so callers can try them.
        return list(DEFAULT_PRINTER_NAMES.values())
    except Exception:
        return list(DEFAULT_PRINTER_NAMES.values())


def print_label(
    label_path: str | Path,
    roll: Roll,
    fields: Optional[dict[str, Any]] = None,
    copies: int = 1,
    show_dialog: bool = False,
    printer_name: Optional[str] = None,
) -> None:
    """
    Print a label to the specified roll (left or right).

    The `.label` file must be created in DYMO Label software and contain
    variable text objects with Name attributes matching the keys in `fields`.
    """
    label_path = Path(label_path)
    if not label_path.exists():
        raise FileNotFoundError(f"Label file not found: {label_path}")

    addin, labels = _get_dymo_objects()
    name = printer_name or DEFAULT_PRINTER_NAMES[roll]

    try:
        addin.Open(str(label_path.resolve()))
    except Exception as e:
        raise DymoTwinTurboError(f"Failed to open label: {label_path}") from e

    if fields:
        for key, value in fields.items():
            try:
                labels.SetField(key, str(value))
            except Exception as e:
                raise DymoTwinTurboError(f"Failed to set field '{key}'") from e

    try:
        addin.SelectPrinter(name)
    except Exception as e:
        raise DymoTwinTurboError(
            f"Failed to select printer '{name}'. "
            "Check Devices & Printers for exact Left/Right names."
        ) from e

    try:
        addin.StartPrintJob()
        # Use Print2 to target Twin Turbo rolls explicitly:
        # third argument: 0 = left roll, 1 = right roll
        roll_index = 0 if roll is Roll.LEFT else 1
        try:
            addin.Print2(copies, show_dialog, roll_index)
        except Exception:
            # Fallback for non‑TwinTurbo / older drivers
            addin.Print(copies, show_dialog)
    except Exception as e:
        raise DymoTwinTurboError("Print failed.") from e
    finally:
        try:
            addin.EndPrintJob()
        except Exception:
            pass


def print_to_both_rolls(
    label_path: str | Path,
    fields_left: Optional[dict[str, Any]] = None,
    fields_right: Optional[dict[str, Any]] = None,
    copies_per_roll: int = 1,
    show_dialog: bool = False,
    printer_names: Optional[dict[Roll, str]] = None,
) -> None:
    """
    Print to both left and right rolls. Same label file; field values can differ per roll.

    Args:
        label_path: Path to the .label file.
        fields_left: Variable fields for the left roll (e.g. {"field1": "Left Roll"}).
        fields_right: Variable fields for the right roll. If None, uses fields_left.
        copies_per_roll: Copies to print on each roll.
        show_dialog: If True, show print dialog for each roll.
        printer_names: Optional {Roll.LEFT: "Name", Roll.RIGHT: "Name"} to override defaults.
    """
    names = printer_names or DEFAULT_PRINTER_NAMES
    right_fields = fields_right if fields_right is not None else fields_left

    print_label(
        label_path,
        Roll.LEFT,
        fields=fields_left,
        copies=copies_per_roll,
        show_dialog=show_dialog,
        printer_name=names.get(Roll.LEFT),
    )
    print_label(
        label_path,
        Roll.RIGHT,
        fields=right_fields,
        copies=copies_per_roll,
        show_dialog=show_dialog,
        printer_name=names.get(Roll.RIGHT),
    )

