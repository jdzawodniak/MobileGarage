from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Optional

from mobile_garage.config import dymo_settings
from mobile_garage.printing.dymo_twin_turbo import (
    Roll,
    DymoTwinTurboError,
    print_label,
    print_to_both_rolls,
)


def _resolve_label_path(explicit: Optional[Path] = None) -> Path:
    if explicit is not None:
        return explicit
    if dymo_settings.DYMO_LABEL_PATH is None:
        raise FileNotFoundError(
            "DYMO_LABEL_PATH is not configured. Set the DYMO_LABEL_PATH environment "
            "variable to the .label file path."
        )
    return dymo_settings.DYMO_LABEL_PATH


def _printer_name_for_roll(roll: Roll) -> str | None:
    if roll is Roll.LEFT and dymo_settings.DYMO_PRINTER_LEFT:
        return dymo_settings.DYMO_PRINTER_LEFT
    if roll is Roll.RIGHT and dymo_settings.DYMO_PRINTER_RIGHT:
        return dymo_settings.DYMO_PRINTER_RIGHT
    return None


def print_shipping_label(
    recipient_name: str,
    due_date: _dt.date,
    roll: Roll,
    label_path: Optional[Path] = None,
) -> None:
    """
    Print a simple shipping-style label for a job/customer.

    The underlying .label file is expected to have at least two variable fields:
    - field1: recipient name (or primary text)
    - field2: due date (or secondary text)
    """
    path = _resolve_label_path(label_path)
    fields = {
        "field1": recipient_name,
        "field2": due_date.strftime("%Y-%m-%d"),
    }

    printer_name = _printer_name_for_roll(roll)
    print_label(
        path,
        roll,
        fields=fields,
        copies=1,
        show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
        printer_name=printer_name,
    )


def print_item_label(
    name: str,
    location_code: str,
    roll: str,
    label_path: Optional[Path] = None,
) -> None:
    """
    Print an item label (e.g. for inventory). Uses field1 = name, field2 = location_code.
    The .label file must have variable text objects named field1 and field2.
    roll: "left", "right", or "both".
    """
    path = _resolve_label_path(label_path)
    fields = {
        "field1": name,
        "field2": location_code,
    }
    roll_lower = (roll or "left").strip().lower()
    if roll_lower == "right":
        r = Roll.RIGHT
        printer_name = _printer_name_for_roll(r)
        print_label(
            path,
            r,
            fields=fields,
            copies=1,
            show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
            printer_name=printer_name,
        )
    elif roll_lower == "both":
        printer_names = {}
        if dymo_settings.DYMO_PRINTER_LEFT:
            printer_names[Roll.LEFT] = dymo_settings.DYMO_PRINTER_LEFT
        if dymo_settings.DYMO_PRINTER_RIGHT:
            printer_names[Roll.RIGHT] = dymo_settings.DYMO_PRINTER_RIGHT
        print_to_both_rolls(
            path,
            fields_left=fields,
            fields_right=fields,
            copies_per_roll=1,
            show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
            printer_names=printer_names or None,
        )
    else:
        # left (default)
        r = Roll.LEFT
        printer_name = _printer_name_for_roll(r)
        print_label(
            path,
            r,
            fields=fields,
            copies=1,
            show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
            printer_name=printer_name,
        )


def print_dual_labels_for_job(
    left_text: str,
    right_text: str,
    base_date: Optional[_dt.date] = None,
    label_path: Optional[Path] = None,
) -> None:
    """
    Print a pair of labels, one on each roll, using a common template.

    Example usage could be:
    - Left roll: customer or job info.
    - Right roll: internal tracking info or a derived date.
    """
    path = _resolve_label_path(label_path)
    today = base_date or _dt.date.today()
    fields_left = {
        "field1": left_text,
        "field2": today.strftime("%Y-%m-%d"),
    }
    fields_right = {
        "field1": right_text,
        "field2": (today + _dt.timedelta(days=7)).strftime("%Y-%m-%d"),
    }

    printer_names = {}
    if dymo_settings.DYMO_PRINTER_LEFT:
        printer_names[Roll.LEFT] = dymo_settings.DYMO_PRINTER_LEFT
    if dymo_settings.DYMO_PRINTER_RIGHT:
        printer_names[Roll.RIGHT] = dymo_settings.DYMO_PRINTER_RIGHT

    print_to_both_rolls(
        path,
        fields_left=fields_left,
        fields_right=fields_right,
        copies_per_roll=1,
        show_dialog=dymo_settings.DYMO_SHOW_DIALOG,
        printer_names=printer_names or None,
    )


__all__ = [
    "Roll",
    "DymoTwinTurboError",
    "print_shipping_label",
    "print_item_label",
    "print_dual_labels_for_job",
]

