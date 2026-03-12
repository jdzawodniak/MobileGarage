"""
Example: print to left roll, right roll, or both rolls on DYMO LabelWriter 450 Twin Turbo.

Usage:
  python -m examples.print_both_rolls left   -- print one label on left roll
  python -m examples.print_both_rolls right  -- print one label on right roll
  python -m examples.print_both_rolls both  -- print one label on each roll (different text)

Set LABEL_PATH to your .label file path (with variable fields e.g. TEXT1, TEXT2).
"""

import datetime
import sys
from pathlib import Path

# Add project root so we can import src
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.dymo_twin_turbo import Roll, DymoTwinTurboError, print_label, print_to_both_rolls

# --- Configure your label file path and variable field names here ---
LABEL_PATH = Path(r"E:\TestLabel2.label")  # Your label file from DYMO Label software
# Variable fields in the label (adjust names to match your .label file)
FIELD_MAIN = "field1"
FIELD_DATE = "field2"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("Usage: python -m examples.print_both_rolls <left|right|both>")
        sys.exit(1)

    roll_arg = sys.argv[1].strip().lower()
    if roll_arg not in ("left", "right", "both"):
        print("Argument must be: left, right, or both")
        sys.exit(1)

    if not LABEL_PATH.exists():
        print(f"Label file not found: {LABEL_PATH}")
        print("Edit LABEL_PATH in this script to point to your .label file.")
        sys.exit(1)

    try:
        if roll_arg == "left":
            print_label(
                LABEL_PATH,
                Roll.LEFT,
                fields={
                    FIELD_MAIN: "Hello Left Roll",
                    FIELD_DATE: str(datetime.date.today() + datetime.timedelta(days=30)),
                },
                copies=1,
                show_dialog=False,
            )
            print("Printed 1 label to LEFT roll.")

        elif roll_arg == "right":
            print_label(
                LABEL_PATH,
                Roll.RIGHT,
                fields={
                    FIELD_MAIN: "Hello Right Roll",
                    FIELD_DATE: str(datetime.date.today() + datetime.timedelta(days=30)),
                },
                copies=1,
                show_dialog=False,
            )
            print("Printed 1 label to RIGHT roll.")

        else:  # both
            print_to_both_rolls(
                LABEL_PATH,
                fields_left={
                    FIELD_MAIN: "Left Roll",
                    FIELD_DATE: str(datetime.date.today()),
                },
                fields_right={
                    FIELD_MAIN: "Right Roll",
                    FIELD_DATE: str(datetime.date.today() + datetime.timedelta(days=7)),
                },
                copies_per_roll=1,
                show_dialog=False,
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
