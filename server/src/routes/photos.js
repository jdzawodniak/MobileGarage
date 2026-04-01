import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import decodeHeic from 'heic-decode';
import jpeg from 'jpeg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = path.join(uploadDir, new Date().toISOString().slice(0, 7));
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname || '';
    const extOk = /\.(jpe?g|png|heic|heif|webp)$/i.test(name);
    const mime = (file.mimetype || '').toLowerCase();
    const mimeOk = /^image\/(jpeg|pjpeg|png|heic|heif|webp)$/.test(mime);
    cb(null, extOk || mimeOk);
  },
});

const router = Router();

/** ISO BMFF `ftyp` + HEIF brands (same idea as heic-decode / file-type). */
function looksLikeHeif(buf) {
  if (!buf || buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('ascii', 8, 12).replace(/\0/g, ' ').trim();
  return /^(mif1|msf1|heic|heix|hevc|hevx)$/i.test(brand);
}

function looksLikeJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

async function writeResizedJpeg(outputPath, pipeline) {
  await pipeline
    .resize({
      width: 800,
      height: 800,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 65, mozjpeg: true })
    .toFile(outputPath);
}

/**
 * Normalize phone photos to JPEG: HEIC-as-.jpg (iPhone), strict JPEGs Sharp rejects, etc.
 */
async function convertUploadBufferToJpeg(buf, outputPath) {
  const fromRgba = (data, width, height) =>
    writeResizedJpeg(
      outputPath,
      sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }),
    );

  if (looksLikeHeif(buf)) {
    const { width, height, data } = await decodeHeic({ buffer: buf });
    await fromRgba(data, width, height);
    return;
  }

  try {
    await writeResizedJpeg(outputPath, sharp(buf, { failOn: 'none' }).rotate());
    return;
  } catch (firstErr) {
    if (looksLikeJpeg(buf)) {
      try {
        const decoded = jpeg.decode(buf, {
          useTArray: true,
          formatAsRGBA: true,
          maxMemoryUsageInMB: 64,
          maxResolutionInMP: 32,
        });
        const { width, height, data } = decoded;
        if (data && width && height) {
          await fromRgba(data, width, height);
          return;
        }
      } catch {
        /* fall through */
      }
    }
    try {
      const { width, height, data } = await decodeHeic({ buffer: buf });
      await fromRgba(data, width, height);
      return;
    } catch {
      /* not HEIC */
    }
    throw firstErr;
  }
}

function uploadSingle(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 10 MB)' });
    }
    return res.status(400).json({ error: err.message || 'Upload failed' });
  });
}

router.post('/', uploadSingle, async (req, res) => {
  if (!req.file || !req.file.size) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const parsed = path.parse(req.file.path);
  const outputPath = path.join(parsed.dir, `${parsed.name}.jpg`);

  try {
    const buf = await fsp.readFile(req.file.path);
    await convertUploadBufferToJpeg(buf, outputPath);
  } catch (err) {
    console.warn('[photos] decode failed:', err.message);
    return res.status(400).json({
      error:
        'Could not read this image. If it is from an iPhone, try Settings → Camera → Formats → Most Compatible, or take the photo again.',
    });
  }

  if (req.file.path !== outputPath && fs.existsSync(req.file.path)) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}
  }

  const relative = path.relative(uploadDir, outputPath).replace(/\\/g, '/');
  res.status(201).json({ path: relative, url: `/uploads/${relative}` });
});

export default router;
