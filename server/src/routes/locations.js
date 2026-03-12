import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  const { q, building, type, storage_id } = req.query;
  let sql = `
    SELECT l.*, su.building_code, su.storage_type, su.storage_id
    FROM locations l
    JOIN storage_units su ON l.storage_unit_id = su.id
    WHERE 1=1
  `;
  const params = [];
  if (q) {
    sql += " AND (l.location_code LIKE ? OR l.description LIKE ?)";
    const term = `%${q}%`;
    params.push(term, term);
  }
  if (building) { sql += ' AND su.building_code = ?'; params.push(building); }
  if (type) { sql += ' AND su.storage_type = ?'; params.push(type); }
  if (storage_id) { sql += ' AND su.storage_id = ?'; params.push(storage_id); }
  sql += ' ORDER BY l.location_code';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT l.*, su.building_code, su.storage_type, su.storage_id
    FROM locations l
    JOIN storage_units su ON l.storage_unit_id = su.id
    WHERE l.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Location not found' });

  const items = db.prepare('SELECT * FROM items WHERE location_id = ?').all(row.id);
  res.json({ ...row, items });
});

router.patch('/:id', (req, res) => {
  const { description, large_label_printed } = req.body;
  const updates = [];
  const params = [];
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (large_label_printed !== undefined) { updates.push('large_label_printed = ?'); params.push(large_label_printed ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE locations SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  res.json(row);
});

export default router;
