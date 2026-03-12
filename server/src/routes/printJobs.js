import { Router } from 'express';
import { db } from '../db/index.js';
import { getPendingPrintJobs, markPrintJobComplete, markPrintJobFailed } from '../services/printQueue.js';
import { enqueuePrintJob } from '../services/printQueue.js';

const router = Router();

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM print_jobs WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/pending', (req, res) => {
  const rows = getPendingPrintJobs(Number(req.query.limit) || 10);
  res.json(rows);
});

router.patch('/:id/complete', (req, res) => {
  markPrintJobComplete(req.params.id);
  const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.patch('/:id/fail', (req, res) => {
  markPrintJobFailed(req.params.id, req.body?.reason);
  const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.post('/reprint', (req, res) => {
  const { job_type, reference_type, reference_id } = req.body;
  if (!job_type || !reference_type || !reference_id) {
    return res.status(400).json({ error: 'job_type, reference_type, reference_id required' });
  }
  const id = enqueuePrintJob(job_type, reference_type, reference_id);
  res.status(201).json({ id, status: 'pending' });
});

export default router;
