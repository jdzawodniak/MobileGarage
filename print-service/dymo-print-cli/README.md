# DymoPrint CLI

Command-line wrapper for the DYMO DLS COM API. Used by the print service to print small (item) labels and run the "Test connection (left)" action without the Windows print dialog or WMI.

## Prerequisites

- Windows with **DYMO Label v8.2+** or **DLS 7** installed (registers the COM library).
- .NET Framework 4.8 (or compatible) and MSBuild, or Visual Studio.

## Build (x86 required)

The DYMO COM library is 32-bit; build this project as **x86**:

**Visual Studio:** Open `DymoPrintCli.csproj`, set platform to **x86**, build (Debug or Release).

**Command line (Developer Command Prompt or path to MSBuild):**

```bat
msbuild DymoPrintCli.csproj /p:Configuration=Release /p:Platform=x86
```

Output: `bin\Release\DymoPrint.exe` (or `bin\Debug\DymoPrint.exe`).

Copy `DymoPrint.exe` to `print-service\bin\` (or set `DYMO_CLI_PATH` in `.env` to the exe path).

## Usage

```
DymoPrint /printer "Printer Name" /tray 0|1|2 [/copies N] [/objdata "ObjectName=value" ...] "path\to\label.label"
```

- **/printer** – Windows printer name (e.g. `DYMO LabelWriter 450 Twin Turbo (Left)`).
- **/tray** – 0 = Left, 1 = Right, 2 = Auto.
- **/copies** – Number of copies (default 1).
- **/objdata** – Repeat for each label object: `"ObjectName=value"`. Use `%20` for newline in value.
- Last positional argument – path to a `.label` or `.LWL` file.

Exit code 0 on success, 1 on failure (message on stderr).
