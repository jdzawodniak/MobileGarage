"""
Diagnostic: check Python bitness and DYMO COM availability.

Run: python examples/check_dymo_com.py

If you see "Class not registered" or "Invalid class string", DYMO Label is
usually 32-bit — install and use 32-bit Python so COM can find it.
"""

import struct
import sys

def main():
    bits = struct.calcsize("P") * 8
    print(f"Python: {sys.version}")
    print(f"Bitness: {bits}-bit")
    print()

    if sys.platform != "win32":
        print("DYMO COM is Windows-only.")
        return

    try:
        import win32com.client
    except ImportError:
        print("pywin32 not installed. Run: pip install pywin32")
        return

    print("Trying win32com.client.Dispatch('Dymo.DymoAddIn') ...")
    try:
        dymo = win32com.client.Dispatch("Dymo.DymoAddIn")
        print("OK — DYMO COM is available.")
        return
    except Exception as e:
        print(f"Error: {e}")
        if bits == 64:
            print()
            print("You are on 64-bit Python. DYMO Label software is often 32-bit,")
            print("so its COM server is only visible to 32-bit processes.")
            print("Try installing 32-bit Python and run this script with that Python.")
        return

if __name__ == "__main__":
    main()
