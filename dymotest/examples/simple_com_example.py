"""
Minimal COM example: single-roll print using raw win32com (no wrapper).

Use this as reference for SelectPrinter("...Left") vs SelectPrinter("...Right").
Replace C:\\path\\to\\my.label with your .label file and run from project root:

  python examples/simple_com_example.py
"""

import datetime
import sys
from pathlib import Path

if sys.platform != "win32":
    print("This example runs only on Windows.")
    sys.exit(1)

import win32com.client

LABEL_FILE = r"e:\label.txt"
# Use one of: "DYMO LabelWriter 450 Twin Turbo Left" | "DYMO LabelWriter 450 Twin Turbo Right"
PRINTER_NAME = "DYMO LabelWriter 450 Twin Turbo Left"

def main():
    if not Path(LABEL_FILE).exists():
        print(f"Label file not found: {LABEL_FILE}")
        print("Edit LABEL_FILE in this script.")
        sys.exit(1)

    dymo_label = win32com.client.Dispatch("Dymo.DymoAddIn")
    dymo_label.Open(LABEL_FILE)
    dymo_label.SetField("TEXT1", "Hello Left Roll")
    dymo_label.SetField("TEXT2", str(datetime.date.today() + datetime.timedelta(days=30)))
    dymo_label.SelectPrinter(PRINTER_NAME)
    dymo_label.StartPrintJob()
    dymo_label.Print(1, False)  # copies, show_dialog
    dymo_label.EndPrintJob()
    print("Done.")

if __name__ == "__main__":
    main()
