"""
Example: print to left roll, right roll, or both rolls on
DYMO LabelWriter 450 Twin Turbo from the main Mobile_Garage project.

Usage:
  python -m examples.print_both_rolls left
  python -m examples.print_both_rolls right
  python -m examples.print_both_rolls both

This script uses DYMO_LABEL_PATH and optional DYMO_PRINTER_LEFT /
DYMO_PRINTER_RIGHT environment variables as described in DYMO_SETUP.md.
"""

import datetime
import sys
from pathlib import Path

# Ensure src is on the path so mobile_garage can be imported from project root
_project_root = Path(__file__).resolve().parent.parent
_src = _project_root / "src"
if _src.exists() and str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

from mobile_garage.config import dymo_settings
from mobile_garage.printing.dymo_twin_turbo import (
    Roll,
    DymoTwinTurboError,
    print_label,
    print_to_both_rolls,
)


def _resolve_label_path() -> Path:
    if dymo_settings.DYMO_LABEL_PATH is None:
        raise FileNotFoundError(
            "DYMO_LABEL_PATH is not configured. Set the DYMO_LABEL_PATH "
            "environment variable to the .label file path."
        )
    return dymo_settings.DYMO_LABEL_PATH


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        print("Usage: python -m examples.print_both_rolls <left|right|both>")
        sys.exit(1)

    roll_arg = sys.argv[1].strip().lower()
    if roll_arg not in ("left", "right", "both"):
        print("Argument must be: left, right, or both")
        sys.exit(1)

    try:
        label_path = _resolve_label_path()
    except FileNotFoundError as e:
        print(e)
        sys.exit(1)

    if not label_path.exists():
        print(f"Label file not found: {label_path}")
        print("Set DYMO_LABEL_PATH to point to your .label file.")
        sys.exit(1)

    try:
        if roll_arg == "left":
            print_label(
                label_path,
                Roll.LEFT,
                fields={
                    "field1": "Hello Left Roll",
                    "field2": str(datetime.date.today() + datetime.timedelta(days=30)),
                },
                copies=1,
                show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
            )
            print("Printed 1 label to LEFT roll.")

        elif roll_arg == "right":
            print_label(
                label_path,
                Roll.RIGHT,
                fields={
                    "field1": "Hello Right Roll",
                    "field2": str(datetime.date.today() + datetime.timedelta(days=30)),
                },
                copies=1,
                show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
            )
            print("Printed 1 label to RIGHT roll.")

        else:  # both
            printer_names = {}
            if dymo_settings.DYMO_PRINTER_LEFT:
                printer_names[Roll.LEFT] = dymo_settings.DYMO_PRINTER_LEFT
            if dymo_settings.DYMO_PRINTER_RIGHT:
                printer_names[Roll.RIGHT] = dymo_settings.DYMO_PRINTER_RIGHT

            print_to_both_rolls(
                label_path,
                fields_left={
                    "field1": "Left Roll",
                    "field2": str(datetime.date.today()),
                },
                fields_right={
                    "field1": "Right Roll",
                    "field2": str(datetime.date.today() + datetime.timedelta(days=7)),
                },
                copies_per_roll=1,
                show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
                printer_names=printer_names or None,
            )
            print("Printed 1 label to LEFT roll and 1 to RIGHT roll.")

    except DymoTwinTurboError as e:
        print(f"DYMO error: {e}")
        sys.exit(1)
    except FileNotFoundError as e:
        print(e)
        sys.exit(1)


if __name__ == "__main__":
    main()

