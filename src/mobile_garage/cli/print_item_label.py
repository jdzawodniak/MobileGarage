"""
CLI for printing a single item label via DYMO. Used by the print-service when
DYMO_USE_PYTHON is set.

Usage:
  python -m mobile_garage.cli.print_item_label --name "Widget" --location "A-01" [--roll left|right|both]

Requires DYMO_LABEL_PATH (or run from project root with PYTHONPATH=src and set env).
"""
import argparse
import sys
from pathlib import Path

# Ensure src is on the path when run as __main__ (e.g. from print-service without PYTHONPATH)
if __name__ == "__main__":
    # .../src/mobile_garage/cli/print_item_label.py -> parent.parent.parent = src
    _file = Path(__file__).resolve()
    _src = _file.parent.parent.parent
    if _src.name == "src" and str(_src) not in sys.path:
        sys.path.insert(0, str(_src))

from mobile_garage.config import dymo_settings
from mobile_garage.printing.api import DymoTwinTurboError, print_item_label


def main() -> int:
    parser = argparse.ArgumentParser(description="Print an item label to the DYMO (field1=name, field2=location).")
    parser.add_argument("--name", required=True, help="Item name (field1)")
    parser.add_argument("--location", default="", help="Location code (field2)")
    parser.add_argument("--roll", choices=["left", "right", "both"], default="left", help="Roll to print to")
    parser.add_argument("--label-path", default=None, help="Override .label file path (default: DYMO_LABEL_PATH)")
    args = parser.parse_args()

    label_path = Path(args.label_path) if args.label_path else None
    if label_path is not None and not label_path.exists():
        print(f"Label file not found: {label_path}", file=sys.stderr)
        return 1

    try:
        print_item_label(
            name=args.name,
            location_code=args.location,
            roll=args.roll,
            label_path=label_path,
        )
        return 0
    except DymoTwinTurboError as e:
        print(f"DYMO error: {e}", file=sys.stderr)
        return 1
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
