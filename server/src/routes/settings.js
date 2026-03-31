import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const envPath = path.join(projectRoot, 'print-service', '.env');

function readPrintEnv() {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function resolveTemplatePath(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (path.isAbsolute(s) || (s.length >= 2 && s[1] === ':')) return s;
  return path.resolve(projectRoot, s);
}

function getTemplateConfig() {
  const env = readPrintEnv();
  const smallRaw = env.DYMO_LABEL_TEMPLATE || env.DYMO_LABEL_PATH || '';
  const largeRaw = env.DYMO_LARGE_LABEL_TEMPLATE || env.DYMO_LARGE_LABEL_PATH || '';
  const smallPath = resolveTemplatePath(smallRaw);
  const largePath = resolveTemplatePath(largeRaw);
  return {
    small: { raw: smallRaw, path: smallPath, exists: smallPath ? fs.existsSync(smallPath) : false },
    large: { raw: largeRaw, path: largePath, exists: largePath ? fs.existsSync(largePath) : false },
    env_path: envPath,
  };
}

router.get('/templates', (req, res) => {
  res.json(getTemplateConfig());
});

router.post('/open-template', (req, res) => {
  const type = req.body?.type;
  if (!['small', 'large'].includes(type)) {
    return res.status(400).json({ error: 'type must be "small" or "large"' });
  }
  const cfg = getTemplateConfig();
  const target = cfg[type];
  if (!target?.path) return res.status(400).json({ error: `No ${type} template configured in print-service/.env` });
  if (!target.exists) return res.status(404).json({ error: `${type} template file not found: ${target.path}` });

  try {
    const child = spawn('explorer.exe', [`/select,${target.path}`], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    res.json({ ok: true, path: target.path });
  } catch (err) {
    res.status(500).json({ error: `Failed to open Explorer: ${err.message}` });
  }
});

router.post('/open-template-env', (req, res) => {
  if (!fs.existsSync(envPath)) {
    return res.status(404).json({ error: `print-service/.env not found at ${envPath}` });
  }
  try {
    const child = spawn('explorer.exe', ['/select,', envPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    res.json({ ok: true, path: envPath });
  } catch (err) {
    res.status(500).json({ error: `Failed to open Explorer: ${err.message}` });
  }
});

export default router;
