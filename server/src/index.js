import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import storageUnitsRouter from './routes/storageUnits.js';
import locationsRouter from './routes/locations.js';
import itemsRouter from './routes/items.js';
import photosRouter from './routes/photos.js';
import printJobsRouter from './routes/printJobs.js';
import settingsRouter from './routes/settings.js';
import { db } from './db/index.js';
import { schema } from './db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure DB and upload dirs exist
const dataDir = path.resolve(__dirname, '../data');
const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads');
[dataDir, uploadDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Initialize schema if empty
db.exec(schema);

const app = express();
const PORT = process.env.PORT || 3011;

app.use(cors());
app.use(express.json());

// Static uploads
app.use('/uploads', express.static(uploadDir));

// Optional API key check (skip if API_KEY not set)
app.use((req, res, next) => {
  const key = process.env.API_KEY;
  if (!key || key === 'your-secret-api-key-change-in-production') return next();
  const auth = req.headers.authorization || req.query.api_key || '';
  if (auth.replace('Bearer ', '').trim() !== key.trim()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.use('/api/storage-units', storageUnitsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/print-jobs', printJobsRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: 'connected' });
});

// Serve web UI
const webDir = path.join(__dirname, 'web');
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir));
  app.get('/', (req, res) => res.sendFile(path.join(webDir, 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Inventory server running at http://localhost:${PORT} (LAN: http://0.0.0.0:${PORT})`);
});
