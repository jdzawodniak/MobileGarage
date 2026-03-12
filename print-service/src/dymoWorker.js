// DYMO print worker script (Node -> Python bridge).
// This module is responsible for taking print jobs from the queue and
// invoking the Python-based DYMO printing CLI.
//
// For now we provide a stub that logs what would be printed; the actual
// wiring to Python can be added once the CLI entrypoint is decided.

import { spawn } from 'child_process';

export function runDymoPrintJob(job) {
  // Placeholder: integrate with a Python CLI that calls mobile_garage.printing.api
  // e.g. `python -m mobile_garage.cli.print_label ...`
  console.log('DYMO print job stub:', job);

  // Example of how a real integration might look:
  // const args = ['-m', 'mobile_garage.cli.print_label', '--job-id', String(job.id)];
  // const child = spawn('python', args, { stdio: 'inherit' });
  // child.on('exit', (code) => { ... });
}

