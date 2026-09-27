import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SOURCE_IMAGE = path.resolve(rootDir, 'src/assets/sjdb_image.png');
const CACHE_FILE = path.resolve(rootDir, '.pwa-icons-cache.json');
const PUBLIC_DIR = path.resolve(rootDir, 'public');
const DIST_DIR = path.resolve(rootDir, 'dist');
const MANIFEST_FILE = path.resolve(PUBLIC_DIR, 'manifest.json');
const INDEX_HTML = path.resolve(rootDir, 'index.html');

// Helper to build a valid ICO file from PNG buffers
function createIcoFromPngBuffers(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(count, 4); // count of images

  const dirEntries = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

/**
 * Computes SHA-256 hash of a file
 */
function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Core icon generation using Sharp
 */
async function generateWithSharp(sharp, srcBuffer, hash) {
  const meta = await sharp(srcBuffer).metadata();
  const width = meta.width;
  const height = meta.height;

  // Compute square crop focusing on the upper body & face
  let cropWidth = Math.min(width, height);
  let cropHeight = cropWidth;
  let cropLeft = 0;
  let cropTop = 0;

  if (height > width) {
    cropLeft = 0;
    cropTop = 0; // Focus on top portion where halo, head, palm, crucifix, and hands reside
  } else if (width > height) {
    cropLeft = Math.round((width - height) / 2);
    cropTop = 0;
  }

  const squareCrop = sharp(srcBuffer).extract({
    left: cropLeft,
    top: cropTop,
    width: cropWidth,
    height: cropHeight
  });

  const [icon512Buf, icon192Buf, appleBuf, fav64Buf, p48, p32, p16] = await Promise.all([
    squareCrop.clone().resize(512, 512, { fit: 'cover' }).png().toBuffer(),
    squareCrop.clone().resize(192, 192, { fit: 'cover' }).png().toBuffer(),
    squareCrop.clone().resize(180, 180, { fit: 'cover' }).png().toBuffer(),
    squareCrop.clone().resize(64, 64, { fit: 'cover' }).png().toBuffer(),
    squareCrop.clone().resize(48, 48, { fit: 'cover' }).png().toBuffer(),
    squareCrop.clone().resize(32, 32, { fit: 'cover' }).png().toBuffer(),
    squareCrop.clone().resize(16, 16, { fit: 'cover' }).png().toBuffer()
  ]);

  const icoBuf = createIcoFromPngBuffers([p16, p32, p48], [16, 32, 48]);

  return {
    'icon-512.png': icon512Buf,
    'icon-192.png': icon192Buf,
    'apple-touch-icon.png': appleBuf,
    'favicon.png': fav64Buf,
    'favicon.ico': icoBuf
  };
}

/**
 * Fallback icon generation using Python PIL if sharp isn't loaded
 */
async function generateWithPython(srcPath) {
  const { execSync } = await import('child_process');
  const tempScript = path.resolve(rootDir, '.temp_generate_icons.py');
  const pyCode = `
import sys, os
from PIL import Image

src_path = sys.argv[1]
out_dir = sys.argv[2]
img = Image.open(src_path)
w, h = img.size
crop_size = min(w, h)
top = 0
left = 0 if h >= w else int((w - h) / 2)
cropped = img.crop((left, top, left + crop_size, top + crop_size))

cropped.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'icon-512.png'))
cropped.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'icon-192.png'))
cropped.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'apple-touch-icon.png'))
cropped.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'favicon.png'))

p16 = cropped.resize((16, 16), Image.Resampling.LANCZOS)
p32 = cropped.resize((32, 32), Image.Resampling.LANCZOS)
p48 = cropped.resize((48, 48), Image.Resampling.LANCZOS)
p48.save(os.path.join(out_dir, 'favicon.ico'), format='ICO', sizes=[(16,16), (32,32), (48,48)], append_images=[p16, p32])
print("SUCCESS_PY")
`;
  fs.writeFileSync(tempScript, pyCode, 'utf8');
  try {
    execSync(`python "${tempScript}" "${srcPath}" "${PUBLIC_DIR}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
  }
}

/**
 * Updates manifest.json with fresh icon references and hash
 */
function updateManifest(versionHash) {
  const v = versionHash.slice(0, 8);
  const manifestData = {
    short_name: "SJDB Church",
    name: "St. John de Britto Church",
    description: "Official app of St. John de Britto Church — Mass timings, events, prayers & more.",
    id: "/",
    icons: [
      {
        src: `/icon-192.png?v=${v}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: `/icon-192.png?v=${v}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: `/icon-512.png?v=${v}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: `/icon-512.png?v=${v}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: `/apple-touch-icon.png?v=${v}`,
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ],
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#001f3f",
    background_color: "#001f3f",
    categories: [
      "lifestyle",
      "social"
    ],
    lang: "en",
    version: v
  };

  const jsonContent = JSON.stringify(manifestData, null, 2) + '\n';
  fs.writeFileSync(MANIFEST_FILE, jsonContent, 'utf8');

  if (fs.existsSync(DIST_DIR)) {
    const distManifest = path.resolve(DIST_DIR, 'manifest.json');
    fs.writeFileSync(distManifest, jsonContent, 'utf8');
  }
}

/**
 * Updates index.html with cache-busting version query parameter on icon tags
 */
function updateIndexHtml(versionHash) {
  if (!fs.existsSync(INDEX_HTML)) return;
  const v = versionHash.slice(0, 8);
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  // Update favicon and icon link tags
  html = html.replace(/href="\/favicon\.ico(?:\?v=[^"]*)?"/g, `href="/favicon.ico?v=${v}"`);
  html = html.replace(/href="\/favicon\.png(?:\?v=[^"]*)?"/g, `href="/favicon.png?v=${v}"`);
  html = html.replace(/href="\/icon-192\.png(?:\?v=[^"]*)?"/g, `href="/icon-192.png?v=${v}"`);
  html = html.replace(/href="\/icon-512\.png(?:\?v=[^"]*)?"/g, `href="/icon-512.png?v=${v}"`);
  html = html.replace(/href="\/apple-touch-icon\.png(?:\?v=[^"]*)?"/g, `href="/apple-touch-icon.png?v=${v}"`);
  html = html.replace(/href="\/manifest\.json(?:\?v=[^"]*)?"/g, `href="/manifest.json?v=${v}"`);
  html = html.replace(/content="\/icon-512\.png(?:\?v=[^"]*)?"/g, `content="/icon-512.png?v=${v}"`);

  fs.writeFileSync(INDEX_HTML, html, 'utf8');

  if (fs.existsSync(DIST_DIR)) {
    const distHtml = path.resolve(DIST_DIR, 'index.html');
    if (fs.existsSync(distHtml)) {
      let dHtml = fs.readFileSync(distHtml, 'utf8');
      dHtml = dHtml.replace(/href="\/favicon\.ico(?:\?v=[^"]*)?"/g, `href="/favicon.ico?v=${v}"`);
      dHtml = dHtml.replace(/href="\/favicon\.png(?:\?v=[^"]*)?"/g, `href="/favicon.png?v=${v}"`);
      dHtml = dHtml.replace(/href="\/icon-192\.png(?:\?v=[^"]*)?"/g, `href="/icon-192.png?v=${v}"`);
      dHtml = dHtml.replace(/href="\/icon-512\.png(?:\?v=[^"]*)?"/g, `href="/icon-512.png?v=${v}"`);
      dHtml = dHtml.replace(/href="\/apple-touch-icon\.png(?:\?v=[^"]*)?"/g, `href="/apple-touch-icon.png?v=${v}"`);
      dHtml = dHtml.replace(/href="\/manifest\.json(?:\?v=[^"]*)?"/g, `href="/manifest.json?v=${v}"`);
      dHtml = dHtml.replace(/content="\/icon-512\.png(?:\?v=[^"]*)?"/g, `content="/icon-512.png?v=${v}"`);
      fs.writeFileSync(distHtml, dHtml, 'utf8');
    }
  }
}

/**
 * Main synchronizer function
 */
export async function syncPwaIcons(force = false) {
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.warn(`[PWA Icons] Source image not found at: ${SOURCE_IMAGE}`);
    return false;
  }

  const currentHash = getFileHash(SOURCE_IMAGE);
  let cachedHash = null;

  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      cachedHash = cache.hash;
    } catch (_) {}
  }

  // Check if all expected files exist in public/
  const expectedFiles = [
    'icon-512.png',
    'icon-192.png',
    'apple-touch-icon.png',
    'favicon.png',
    'favicon.ico'
  ];
  const allExist = expectedFiles.every(f => fs.existsSync(path.resolve(PUBLIC_DIR, f)));

  if (!force && allExist && cachedHash === currentHash) {
    // Icons are already completely up to date
    return true;
  }

  console.log(`[PWA Icons] Regenerating installed app icons from sjdb_image.png (hash: ${currentHash.slice(0, 8)})...`);

  let generatedIcons = null;
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const srcBuffer = fs.readFileSync(SOURCE_IMAGE);
    generatedIcons = await generateWithSharp(sharp, srcBuffer, currentHash);
  } catch (err) {
    console.warn(`[PWA Icons] Sharp not available (${err.message}). Attempting Python fallback...`);
    try {
      await generateWithPython(SOURCE_IMAGE);
    } catch (pyErr) {
      console.error(`[PWA Icons] Error generating icons with Python fallback:`, pyErr.message);
      return false;
    }
  }

  if (generatedIcons) {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    for (const [filename, buffer] of Object.entries(generatedIcons)) {
      fs.writeFileSync(path.resolve(PUBLIC_DIR, filename), buffer);
      if (fs.existsSync(DIST_DIR)) {
        fs.writeFileSync(path.resolve(DIST_DIR, filename), buffer);
      }
    }
  }

  // Update manifest and index.html with new version query strings
  updateManifest(currentHash);
  updateIndexHtml(currentHash);

  // Write new cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    hash: currentHash,
    source: SOURCE_IMAGE,
    updatedAt: new Date().toISOString()
  }, null, 2), 'utf8');

  console.log(`[PWA Icons] Successfully updated all installed app icons and manifest (v=${currentHash.slice(0, 8)}).`);
  return true;
}

// Direct execution from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isForce = process.argv.includes('--force');
  syncPwaIcons(isForce)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[PWA Icons] Unexpected error:', err);
      process.exit(1);
    });
}
