import { Router } from 'express';
import { db } from '../db/index.js';
import { enqueuePrintJob } from '../services/printQueue.js';

const router = Router();

router.get('/', (req, res) => {
  const { q, location_id } = req.query;
  let sql = `
    SELECT i.*, l.location_code
    FROM items i
    JOIN locations l ON i.location_id = l.id
    WHERE 1=1
  `;
  const params = [];
  if (q) {
    sql += ' AND (i.name LIKE ? OR i.notes LIKE ?)';
    const term = `%${q}%`;
    params.push(term, term);
  }
  if (location_id) { sql += ' AND i.location_id = ?'; params.push(location_id); }
  sql += ' ORDER BY i.name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT i.*, l.location_code, l.id as location_id
    FROM items i
    JOIN locations l ON i.location_id = l.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { location_id, name, notes, photo_path, printer_roll } = req.body;
  if (!location_id || !name) {
    return res.status(400).json({ error: 'location_id and name required' });
  }

  const loc = db.prepare('SELECT id, location_code FROM locations WHERE id = ?').get(location_id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const stmt = db.prepare(`
    INSERT INTO items (location_id, name, notes, photo_path)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(location_id, String(name).trim(), notes || null, photo_path || null);
  const itemId = db.prepare('SELECT last_insert_rowid() as id').get().id;

  const roll = ['left', 'right', 'both', 'test_left'].includes(printer_roll) ? printer_roll : 'left';
  enqueuePrintJob('small', 'item', itemId, {
    name: String(name).trim(),
    location_code: loc.location_code,
    printer_roll: roll,
  });

  const row = db.prepare(`
    SELECT i.*, l.location_code
    FROM items i
    JOIN locations l ON i.location_id = l.id
    WHERE i.id = ?
  `).get(itemId);
  res.status(201).json(row);
});

router.patch('/:id', (req, res) => {
  const { location_id, name, notes, photo_path } = req.body;
  const updates = [];
  const params = [];
  if (location_id !== undefined) { updates.push('location_id = ?'); params.push(location_id); }
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  if (photo_path !== undefined) { updates.push('photo_path = ?'); params.push(photo_path); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare(`
    SELECT i.*, l.location_code
    FROM items i
    JOIN locations l ON i.location_id = l.id
    WHERE i.id = ?
  `).get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
  res.status(204).send();
});

export default router;
