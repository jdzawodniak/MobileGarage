import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from print-service/ so it works whether you run from project root or print-service/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const printServiceEnv = path.join(__dirname, '..', '.env');
dotenv.config({ path: printServiceEnv });

/**
 * Windows Print Service - polls the inventory backend for pending print jobs
 * and sends them to the configured large/small label printers.
 *
 * Configure via environment variables or .env:
 *   API_URL - backend base URL (e.g. http://localhost:3000 or https://your-server.com)
 *   API_KEY - optional, for authenticated backends
 *   LARGE_PRINTER - Windows printer name for large labels (storage areas)
 *   SMALL_PRINTER - Windows printer name for small labels (items)
 *   POLL_INTERVAL_MS - polling interval (default 5000)
 *
 * If LARGE_PRINTER / SMALL_PRINTER are not set, jobs will be logged to console
 * for testing. On Windows you can list printers with: wmic printer get name
 *
 * DYMO SDK path (recommended for Twin Turbo): set DYMO_CLI_PATH and DYMO_LABEL_TEMPLATE
 * to use the DymoPrint CLI (DLS COM) for small labels and Test connection (left).
 */

const API_URL = process.env.API_URL || 'http://localhost:3011';
const API_KEY = process.env.API_KEY || '';
const LARGE_PRINTER = process.env.LARGE_PRINTER || '';
const SMALL_PRINTER = process.env.SMALL_PRINTER || '';
const SMALL_PRINTER_LEFT = process.env.SMALL_PRINTER_LEFT || process.env.SMALL_PRINTER || '';
const SMALL_PRINTER_RIGHT = process.env.SMALL_PRINTER_RIGHT || process.env.SMALL_PRINTER || '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 5000;

// DYMO SDK path: when set, small labels and test_left use DymoPrint CLI (DLS COM) instead of PrintTo/WMI
const DYMO_CLI_PATH = process.env.DYMO_CLI_PATH || '';
const DYMO_LABEL_TEMPLATE = process.env.DYMO_LABEL_TEMPLATE || process.env.DYMO_LABEL_PATH || '';
const DYMO_TEST_LABEL_TEMPLATE = process.env.DYMO_TEST_LABEL_TEMPLATE || DYMO_LABEL_TEMPLATE;
const DYMO_OBJNAME_ITEM = process.env.DYMO_OBJNAME_ITEM || 'ItemName';
const DYMO_OBJNAME_LOCATION = process.env.DYMO_OBJNAME_LOCATION || 'Location';

const useDymoCli = Boolean(DYMO_CLI_PATH && DYMO_LABEL_TEMPLATE);

// Small (item) labels: we print by opening the .label file, substituting field1/field2, and sending to DYMO via COM.
// That is done by the Python module (mobile_garage.printing). We use it whenever a label path is set.
// Do NOT use PrintTo with a text file (that opens Notepad) – that is for generic printers, not DYMO templates.
const DYMO_PYTHON_PATH = process.env.DYMO_PYTHON_PATH || 'python';
// If started from print-service/, cwd has no src/ – use parent as project root
function getMobileGarageRoot() {
  const explicit = process.env.MOBILE_GARAGE_ROOT;
  if (explicit) return path.resolve(explicit);
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'src', 'mobile_garage'))) return cwd;
  const parent = path.join(cwd, '..');
  if (fs.existsSync(path.join(parent, 'src', 'mobile_garage'))) return path.resolve(parent);
  return cwd;
}
const MOBILE_GARAGE_ROOT = getMobileGarageRoot();

function resolveTemplatePath(template, baseDir = process.cwd()) {
  if (!template) return '';
  const s = template.trim();
  if (path.isAbsolute(s) || (s.length >= 2 && s[1] === ':')) return s;
  return path.resolve(baseDir, s);
}

// Use Python COM for small labels when we have a .label path and the Python package exists (default for DYMO).
const _labelPath = resolveTemplatePath(DYMO_LABEL_TEMPLATE, MOBILE_GARAGE_ROOT);
const usePythonForSmallLabels = Boolean(_labelPath && fs.existsSync(path.join(MOBILE_GARAGE_ROOT, 'src', 'mobile_garage')));

async function fetchApi(apiPath, opts = {}) {
  const url = API_URL + apiPath;
  const headers = { ...opts.headers };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  if (opts.body && typeof opts.body === 'string') headers['Content-Type'] = 'application/json';
  const r = await fetch(url, { ...opts, headers });
  if (r.status === 204) return null;
  return r.json();
}

/**
 * Print via DymoPrint CLI (DLS COM). Spawns the exe with /printer, /tray, /objdata, and label path.
 * @param {string} printerName - Windows printer name
 * @param {number} tray - 0=Left, 1=Right, 2=Auto
 * @param {string} labelPath - Full path to .label or .LWL file
 * @param {Array<{name: string, value: string}>} objData - Objects to set, e.g. [{ name: 'ItemName', value: 'Widget' }]
 */
async function printViaDymoCli(printerName, tray, labelPath, objData) {
  const { spawn } = await import('child_process');
  const cliPath = path.isAbsolute(DYMO_CLI_PATH) ? DYMO_CLI_PATH : path.resolve(process.cwd(), DYMO_CLI_PATH);
  const args = ['/printer', printerName, '/tray', String(tray), '/copies', '1'];
  for (const o of objData) {
    if (o.name && o.value != null) args.push('/objdata', `${o.name}=${String(o.value)}`);
  }
  args.push(labelPath);

  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr.trim() || `DymoPrint exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

/**
 * Print item label via Python DYMO module: open .label, set field1=name and field2=location, print to DYMO (COM). No Notepad.
 * Requires DYMO_LABEL_PATH or DYMO_LABEL_TEMPLATE and mobile_garage package under MOBILE_GARAGE_ROOT.
 */
async function printViaPythonDymo(name, locationCode, roll) {
  const { spawn } = await import('child_process');
  const labelPath = resolveTemplatePath(DYMO_LABEL_TEMPLATE, MOBILE_GARAGE_ROOT);
  if (!labelPath) {
    throw new Error('DYMO_LABEL_PATH or DYMO_LABEL_TEMPLATE must be set for Python DYMO');
  }
  const args = [
    '-m', 'mobile_garage.cli.print_item_label',
    '--name', String(name),
    '--location', String(locationCode),
    '--roll', roll,
    '--label-path', labelPath,
  ];
  const srcDir = path.join(MOBILE_GARAGE_ROOT, 'src');
  const env = {
    ...process.env,
    DYMO_LABEL_PATH: labelPath,
    PYTHONPATH: srcDir,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(DYMO_PYTHON_PATH, args, {
      cwd: MOBILE_GARAGE_ROOT,
      env,
      windowsHide: true,
    });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const errLines = [stderr.trim(), stdout.trim()].filter(Boolean);
      const msg = errLines.length ? errLines.join('\n') : `Python exited with code ${code}`;
      reject(new Error(msg));
    });
    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Python: ${err.message}. Is DYMO_PYTHON_PATH correct?`));
    });
  });
}

async function processJob(job) {
  let payload = {};
  try {
    payload = job.payload ? JSON.parse(job.payload) : {};
  } catch (_) {}

  const labelText = formatLabel(job, payload);

  if (job.job_type === 'large') {
    if (!LARGE_PRINTER) {
      console.log(`[DRY-RUN] Would print to large printer:\n${labelText}`);
      return true;
    }
    try {
      await printToPrinter(LARGE_PRINTER, labelText);
      console.log(`[OK] Sent large label (job ${job.id}) to "${LARGE_PRINTER}"`);
      return true;
    } catch (err) {
      console.error('Print error:', err.message || err);
      return false;
    }
  }

  // small (item) label: support printer_roll = left | right | both | test_left
  const roll = payload.printer_roll || 'left';

  if (roll === 'test_left') {
    if (usePythonForSmallLabels) {
      console.log('[TEST] Sending DYMO test label via Python (left roll)');
      try {
        await printViaPythonDymo('Test', 'Connection OK', 'left');
        console.log(`[OK] Test label sent (job ${job.id})`);
        return true;
      } catch (err) {
        console.error('Test label error:', err.message || err);
        return false;
      }
    }
    const printerName = SMALL_PRINTER_LEFT || SMALL_PRINTER;
    if (!printerName) {
      console.log('[DRY-RUN] Would run test page (no printer set)');
      return true;
    }
    if (useDymoCli) {
      const templatePath = resolveTemplatePath(DYMO_TEST_LABEL_TEMPLATE || DYMO_LABEL_TEMPLATE);
      console.log(`[TEST] Sending DYMO test label to left: "${printerName}"`);
      try {
        await printViaDymoCli(printerName, 0, templatePath, [
          { name: DYMO_OBJNAME_ITEM, value: 'Test' },
          { name: DYMO_OBJNAME_LOCATION, value: 'Connection OK' },
        ]);
        console.log(`[OK] Test label sent (job ${job.id})`);
        return true;
      } catch (err) {
        console.error('Test label error:', err.message || err);
        return false;
      }
    }
    console.log(`[TEST] Sending WMI PrintTestPage to left: "${printerName}"`);
    try {
      await printTestPageWmi(printerName);
      console.log(`[OK] Test page sent (job ${job.id})`);
      return true;
    } catch (err) {
      console.error('Test page error:', err.message || err);
      return false;
    }
  }

  // Small item labels: print by substituting item name + location into the .label template and sending to DYMO via COM (Python). No Notepad.
  if (usePythonForSmallLabels) {
    const itemName = payload.name || `Item #${job.reference_id}`;
    const locationCode = payload.location_code || '';
    console.log(`[PRINT] Sending job ${job.id} via Python DYMO (roll: ${roll}) – "${itemName}" @ ${locationCode}`);
    try {
      await printViaPythonDymo(itemName, locationCode, roll);
      console.log(`[OK] Sent small label (job ${job.id}) to DYMO`);
      return true;
    } catch (err) {
      console.error('Python DYMO print error:', err.message || err);
      return false;
    }
  }

  const printers = [];
  if (roll === 'left' || roll === 'both') printers.push({ name: SMALL_PRINTER_LEFT, label: 'left', tray: 0 });
  if (roll === 'right' || roll === 'both') printers.push({ name: SMALL_PRINTER_RIGHT, label: 'right', tray: 1 });

  if (useDymoCli && printers.some((p) => p.name)) {
    const templatePath = resolveTemplatePath(DYMO_LABEL_TEMPLATE);
    const itemName = payload.name || `Item #${job.reference_id}`;
    const locationCode = payload.location_code || '';
    const objData = [
      { name: DYMO_OBJNAME_ITEM, value: itemName },
      { name: DYMO_OBJNAME_LOCATION, value: locationCode },
    ];
    for (const p of printers) {
      if (!p.name) continue;
      console.log(`[PRINT] Sending job ${job.id} to ${p.label} roll via DymoPrint CLI: "${p.name}"`);
      try {
        await printViaDymoCli(p.name, p.tray, templatePath, objData);
        console.log(`[OK] Sent small label (job ${job.id}) to ${p.label} roll`);
      } catch (err) {
        console.error(`Print error (${p.label} roll):`, err.message || err);
        return false;
      }
    }
    return true;
  }

  // No Python COM and no DymoPrint CLI – cannot print DYMO labels. Do not use PrintTo (that opens Notepad with plain text).
  console.log(`[DRY-RUN] Small label (no DYMO path). Set DYMO_LABEL_PATH to your .label file so the service uses Python COM.\n${labelText}`);
  return true;
}

async function printTestPageWmi(printerName) {
  const { spawn } = await import('child_process');
  const nameArg = escapePsArg(printerName);
  // Match by Name in PowerShell (avoids WQL -Filter quoting issues)
  const script = `$n = ${nameArg}; $P = Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq $n }; if (-not $P) { Write-Error "Printer not found: $n"; exit 1 }; $R = $P.PrintTestPage(); if ($R.ReturnValue -ne 0) { Write-Error "PrintTestPage ReturnValue: $($R.ReturnValue)"; exit $R.ReturnValue }`;

  return new Promise((resolve, reject) => {
    const ps = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true }
    );
    let stderr = '';
    let stdout = '';
    ps.stderr.on('data', (chunk) => { stderr += chunk; });
    ps.stdout.on('data', (chunk) => { stdout += chunk; });
    ps.on('close', (code) => {
      if (code === 0) return resolve();
      const msg = [stderr.trim(), stdout.trim()].filter(Boolean).join(' ') || `Exit code ${code}`;
      reject(new Error(msg));
    });
    ps.on('error', reject);
  });
}

function formatLabel(job, payload) {
  if (job.job_type === 'large') {
    const code = payload.building_code && payload.storage_id
      ? `${payload.building_code}-${payload.storage_type || 'Rack'}-${payload.storage_id}`
      : `Storage Unit #${job.reference_id}`;
    return `\n=== STORAGE ===\n${code}\nSpaces: 1-${payload.spaces_count || 24}\n`;
  }
  // small
  const name = payload.name || `Item #${job.reference_id}`;
  const loc = payload.location_code || '';
  return `\n--- ITEM ---\n${name}\nReturn to: ${loc}\n`;
}

function escapePsArg(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

async function printToPrinter(printerName, text) {
  const { spawn } = await import('child_process');
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const tmpFile = path.join(os.tmpdir(), `label-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, text, 'utf8');

  const pathArg = escapePsArg(tmpFile);
  // Match your working command: ArgumentList must be '"Printer Name"' (double quotes inside).
  const nameArg = escapePsArg('"' + String(printerName).replace(/"/g, '""') + '"');
  const script = `Start-Process -FilePath ${pathArg} -Verb PrintTo -ArgumentList ${nameArg} -Wait`;

  return new Promise((resolve, reject) => {
    // Run via cmd start /wait so the print dialog has a visible parent and stays open.
    const ps = spawn(
      'cmd',
      ['/c', 'start', '/wait', '"PrintLabel"', 'powershell', '-NoProfile', '-Command', script],
      { windowsHide: false }
    );

    let stderr = '';
    ps.stderr.on('data', (chunk) => { stderr += chunk; });
    ps.on('close', (code) => {
      if (code === 0) {
        resolve();
        // Don't delete temp file on success: PrintTo opens Notepad/dialog and needs the file.
        // File stays in %TEMP%; Windows cleans old temp files.
      } else {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        reject(new Error(stderr || `PowerShell exited with code ${code}`));
      }
    });
    ps.on('error', (err) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      reject(err);
    });
  });
}

let pollCount = 0;

async function poll() {
  try {
    const jobs = await fetchApi('/api/print-jobs/pending?limit=5');
    if (jobs.length > 0) {
      console.log(`Found ${jobs.length} pending job(s)`);
    } else {
      pollCount++;
      if (pollCount % 12 === 1) {
        console.log('No pending jobs (add an item or storage unit to create a label)');
      }
    }
    for (const job of jobs) {
      const ok = await processJob(job);
      if (ok) {
        await fetchApi(`/api/print-jobs/${job.id}/complete`, { method: 'PATCH' });
      } else {
        await fetchApi(`/api/print-jobs/${job.id}/fail`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: 'Print failed' }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

console.log('Print service started. Polling', API_URL, 'every', POLL_INTERVAL_MS, 'ms');
if (useDymoCli) {
  console.log('DYMO SDK path active: small labels and Test connection use DymoPrint CLI');
}
if (usePythonForSmallLabels) {
  const labelExists = _labelPath && fs.existsSync(_labelPath);
  console.log('Small labels: Python DYMO (COM). label:', _labelPath, labelExists ? '(exists)' : '(FILE NOT FOUND – check path in print-service/.env)');
  if (!labelExists) console.warn('WARN: Label file not found. Item labels will fail until DYMO_LABEL_PATH in print-service/.env points to a valid .label file.');
} else if (DYMO_LABEL_TEMPLATE && !fs.existsSync(path.join(MOBILE_GARAGE_ROOT, 'src', 'mobile_garage'))) {
  console.warn('WARN: DYMO_LABEL_PATH set but mobile_garage not found – start from project root (npm start) or set MOBILE_GARAGE_ROOT.');
} else {
  console.log('Small labels: Add DYMO_LABEL_PATH=E:\\YourPath\\file.label to print-service/.env to print item labels to the DYMO.');
}
if (!LARGE_PRINTER || !SMALL_PRINTER) {
  console.log('LARGE_PRINTER / SMALL_PRINTER not set – large/small dry-run (small uses Python when DYMO_LABEL_PATH is set)');
}

poll();
setInterval(poll, POLL_INTERVAL_MS);
