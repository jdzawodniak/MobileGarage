import { db } from '../db/index.js';

export function enqueuePrintJob(jobType, referenceType, referenceId, payload = null) {
  const stmt = db.prepare(`
    INSERT INTO print_jobs (job_type, reference_type, reference_id, payload, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);
  const result = stmt.run(jobType, referenceType, referenceId, payload ? JSON.stringify(payload) : null);
  return result.lastInsertRowid;
}

export function getPendingPrintJobs(limit = 10) {
  const stmt = db.prepare(`
    SELECT id, job_type, reference_type, reference_id, payload, created_at
    FROM print_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function markPrintJobComplete(id) {
  const stmt = db.prepare(`
    UPDATE print_jobs SET status = 'printed', completed_at = datetime('now') WHERE id = ?
  `);
  return stmt.run(id);
}

export function markPrintJobFailed(id, reason = null) {
  const stmt = db.prepare(`
    UPDATE print_jobs SET status = 'failed', completed_at = datetime('now'), payload = ? WHERE id = ?
  `);
  return stmt.run(reason ? JSON.stringify({ error: reason }) : null, id);
}
