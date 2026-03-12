from __future__ import annotations

import os
from pathlib import Path


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


DYMO_LABEL_PATH_ENV = "DYMO_LABEL_PATH"
DYMO_PRINTER_LEFT_ENV = "DYMO_PRINTER_LEFT"
DYMO_PRINTER_RIGHT_ENV = "DYMO_PRINTER_RIGHT"
DYMO_SHOW_DIALOG_ENV = "DYMO_SHOW_DIALOG"


DYMO_LABEL_PATH: Path | None = (
    Path(os.environ[DYMO_LABEL_PATH_ENV]) if DYMO_LABEL_PATH_ENV in os.environ else None
)

DYMO_PRINTER_LEFT: str | None = os.environ.get(DYMO_PRINTER_LEFT_ENV)
DYMO_PRINTER_RIGHT: str | None = os.environ.get(DYMO_PRINTER_RIGHT_ENV)

DYMO_SHOW_DIALOG: bool = _parse_bool(os.environ.get(DYMO_SHOW_DIALOG_ENV), default=False)

