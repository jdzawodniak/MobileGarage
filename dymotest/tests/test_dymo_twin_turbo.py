"""
Tests for dymo_twin_turbo module.

Run with: pytest tests/ -v

Tests that require a real printer/label file are skipped unless
DYMO_LABEL_PATH env var is set to a valid .label path.
"""

import sys
from pathlib import Path

import pytest

# Project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.dymo_twin_turbo import Roll, DEFAULT_PRINTER_NAMES, DymoTwinTurboError


@pytest.mark.skipif(sys.platform != "win32", reason="DYMO COM is Windows-only")
def test_roll_enum():
    assert Roll.LEFT.value == "left"
    assert Roll.RIGHT.value == "right"
    assert DEFAULT_PRINTER_NAMES[Roll.LEFT] == "DYMO LabelWriter 450 Twin Turbo Left"
    assert DEFAULT_PRINTER_NAMES[Roll.RIGHT] == "DYMO LabelWriter 450 Twin Turbo Right"


@pytest.mark.skipif(sys.platform != "win32", reason="DYMO COM is Windows-only")
def test_get_installed_printers():
    from src.dymo_twin_turbo import get_installed_printers
    try:
        printers = get_installed_printers()
    except DymoTwinTurboError:
        pytest.skip("DYMO Label software not installed or COM unavailable")
    assert isinstance(printers, list)
    assert "DYMO LabelWriter 450 Twin Turbo Left" in printers
    assert "DYMO LabelWriter 450 Twin Turbo Right" in printers


@pytest.mark.skipif(sys.platform != "win32", reason="DYMO COM is Windows-only")
def test_print_label_file_not_found():
    from src.dymo_twin_turbo import print_label
    with pytest.raises(FileNotFoundError):
        print_label(Path(r"C:\nonexistent\file.label"), Roll.LEFT)


@pytest.mark.skipif(sys.platform != "win32", reason="DYMO COM is Windows-only")
def test_print_label_missing_file_raises():
    from src.dymo_twin_turbo import print_label
    with pytest.raises(FileNotFoundError):
        print_label(r"C:\does\not\exist.label", Roll.RIGHT)
