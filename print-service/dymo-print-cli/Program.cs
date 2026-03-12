using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Dymo;

namespace DymoPrintCli
{
    /// <summary>
    /// Command-line wrapper for DYMO DLS COM: prints a label with optional object data and tray selection.
    /// Usage: DymoPrint /printer "Printer Name" /tray 0|1|2 /copies N /objdata "ObjectName=value" ... "path\to\label.label"
    /// Tray: 0=Left, 1=Right, 2=Auto
    /// </summary>
    static class Program
    {
        static int Main(string[] args)
        {
            try
            {
                string printerName = null;
                int tray = 0;
                int copies = 1;
                var objDataList = new List<string>();
                string labelPath = null;

                for (int i = 0; i < args.Length; i++)
                {
                    string param = args[i].Trim();
                    if (string.Equals(param, "/printer", StringComparison.OrdinalIgnoreCase))
                    {
                        if (i + 1 >= args.Length) { Fail("Missing value for /printer"); }
                        printerName = args[++i];
                    }
                    else if (string.Equals(param, "/tray", StringComparison.OrdinalIgnoreCase))
                    {
                        if (i + 1 >= args.Length) { Fail("Missing value for /tray"); }
                        if (!int.TryParse(args[++i], out tray) || tray < 0 || tray > 2)
                            Fail("/tray must be 0 (left), 1 (right), or 2 (auto)");
                    }
                    else if (string.Equals(param, "/copies", StringComparison.OrdinalIgnoreCase))
                    {
                        if (i + 1 >= args.Length) { Fail("Missing value for /copies"); }
                        if (!int.TryParse(args[++i], out copies) || copies < 1)
                            Fail("/copies must be at least 1");
                    }
                    else if (string.Equals(param, "/objdata", StringComparison.OrdinalIgnoreCase))
                    {
                        if (i + 1 >= args.Length) { Fail("Missing value for /objdata"); }
                        objDataList.Add(args[++i]);
                    }
                    else if (!param.StartsWith("/", StringComparison.Ordinal))
                    {
                        labelPath = args[i];
                    }
                }

                if (string.IsNullOrEmpty(labelPath))
                    Fail("Missing label file path (positional argument).");

                dynamic dymoAddIn = null;
                dynamic dymoLabels = null;
                try
                {
                    dymoAddIn = new DymoAddInClass();
                    dymoLabels = new DymoLabelsClass();
                }
                catch (COMException ex)
                {
                    Fail("DYMO COM not available. Install DYMO Label v8.2+ or DLS 7. " + ex.Message);
                }

                if (!string.IsNullOrEmpty(printerName))
                {
                    if (!dymoAddIn.SelectPrinter(printerName))
                        Fail("SelectPrinter failed: " + printerName);
                }

                if (!dymoAddIn.Open(labelPath))
                    Fail("Open failed: " + labelPath);

                int addrIdx = 0;
                foreach (string objData in objDataList)
                {
                    int eq = objData.IndexOf('=');
                    string objName = eq >= 0 ? objData.Substring(0, eq).Trim() : "";
                    string value = eq >= 0 && eq < objData.Length - 1 ? objData.Substring(eq + 1) : objData;
                    value = value.Replace("%20", "\n");
                    if (!string.IsNullOrEmpty(objName))
                    {
                        if (!dymoLabels.SetField(objName, value))
                            Fail("SetField failed for: " + objName);
                    }
                    else
                    {
                        if (!dymoLabels.SetAddress(++addrIdx, value))
                            Fail("SetAddress failed for index " + addrIdx);
                    }
                }

                dymoAddIn.StartPrintJob();
                try
                {
                    if (!dymoAddIn.Print2(copies, false, tray))
                        Fail("Print2 failed.");
                }
                finally
                {
                    dymoAddIn.EndPrintJob();
                }

                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.Message);
                return 1;
            }
        }

        static void Fail(string message)
        {
            throw new ApplicationException(message);
        }
    }
}
