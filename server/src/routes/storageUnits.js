import { Router } from 'express';
import { db } from '../db/index.js';
import { buildLocationCode, normalizeBuildingCode, normalizeStorageType } from '../services/locationCode.js';
import { enqueuePrintJob } from '../services/printQueue.js';

const router = Router();

router.get('/', (req, res) => {
  const { building, type } = req.query;
  let sql = 'SELECT * FROM storage_units WHERE 1=1';
  const params = [];
  if (building) { sql += ' AND building_code = ?'; params.push(normalizeBuildingCode(building)); }
  if (type) { sql += ' AND storage_type = ?'; params.push(normalizeStorageType(type)); }
  sql += ' ORDER BY building_code, storage_type, storage_id';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM storage_units WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Storage unit not found' });
  res.json(row);
});

router.get('/:id/locations', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM locations WHERE storage_unit_id = ? ORDER BY space_number
  `).all(req.params.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { building_code, storage_type, storage_id, spaces_count, description } = req.body;
  const building = normalizeBuildingCode(building_code);
  const type = normalizeStorageType(storage_type);
  const id = String(storage_id || '').trim().toUpperCase();
  const spaces = Math.min(24, Math.max(1, parseInt(spaces_count, 10) || 1));

  if (!building || !type || !id) {
    return res.status(400).json({ error: 'building_code, storage_type, storage_id required' });
  }

  const existing = db.prepare(`
    SELECT id FROM storage_units WHERE building_code = ? AND storage_type = ? AND storage_id = ?
  `).get(building, type, id);
  if (existing) {
    return res.status(409).json({ error: 'Storage unit already exists' });
  }

  const insertUnit = db.prepare(`
    INSERT INTO storage_units (building_code, storage_type, storage_id, spaces_count, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUnit.run(building, type, id, spaces, description || null);
  const unitId = db.prepare('SELECT last_insert_rowid() as id').get().id;

  const insertLoc = db.prepare(`
    INSERT INTO locations (storage_unit_id, space_number, location_code)
    VALUES (?, ?, ?)
  `);

  for (let n = 1; n <= spaces; n++) {
    const code = buildLocationCode(building, type, id, n);
    insertLoc.run(unitId, n, code);
  }

  enqueuePrintJob('large', 'storage_unit', unitId, {
    building_code: building,
    storage_type: type,
    storage_id: id,
    spaces_count: spaces,
  });

  const unit = db.prepare('SELECT * FROM storage_units WHERE id = ?').get(unitId);
  const locations = db.prepare('SELECT * FROM locations WHERE storage_unit_id = ? ORDER BY space_number').all(unitId);
  res.status(201).json({ ...unit, locations });
});

export default router;
