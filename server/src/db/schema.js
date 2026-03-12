/** SQLite schema for inventory system */

export const schema = `
-- Storage unit: e.g. RS Rack A, WS Cabinet D (the physical rack/cabinet)
CREATE TABLE IF NOT EXISTS storage_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_code TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  storage_id TEXT NOT NULL,
  spaces_count INTEGER NOT NULL CHECK (spaces_count >= 1 AND spaces_count <= 24),
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(building_code, storage_type, storage_id)
);

-- Individual storage spaces: RS-Rack-A-1, WS-Cabinet-D-9
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storage_unit_id INTEGER NOT NULL,
  space_number INTEGER NOT NULL CHECK (space_number >= 1 AND space_number <= 24),
  location_code TEXT NOT NULL UNIQUE,
  description TEXT,
  photo_path TEXT,
  large_label_printed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id),
  UNIQUE(storage_unit_id, space_number)
);

CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(location_code);
CREATE INDEX IF NOT EXISTS idx_locations_storage_unit ON locations(storage_unit_id);

-- Items stored in a location
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  photo_path TEXT,
  small_label_printed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

-- Print job queue for Windows print service
CREATE TABLE IF NOT EXISTS print_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL CHECK (job_type IN ('large', 'small')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('location', 'item', 'storage_unit')),
  reference_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'failed')),
  printer_name TEXT,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
`;
