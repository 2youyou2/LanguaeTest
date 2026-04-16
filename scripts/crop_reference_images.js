/**
 * 批量裁剪 references 下的 case-xx.png
 * 逻辑：识别非白色区域（文字），取包围框后加 padding 裁剪。
 *
 * 用法：
 *   node scripts/crop_reference_images.js
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const DIR = path.join(__dirname, '../assets/resources/references');
const FILE_RE = /^case-\d{2}\.png$/i;
const PADDING = 24;
const WHITE_THRESHOLD = 245;
const SCAN_MARGIN = 10; // 忽略四周边框/阴影等 UI 噪声

function isBackground(r, g, b, a) {
  if (a < 8) return true;
  return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function cropOne(filePath) {
  const buf = fs.readFileSync(filePath);
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  const x0 = SCAN_MARGIN;
  const y0 = SCAN_MARGIN;
  const x1 = Math.max(SCAN_MARGIN, width - 1 - SCAN_MARGIN);
  const y1 = Math.max(SCAN_MARGIN, height - 1 - SCAN_MARGIN);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (width * y + x) << 2;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (!isBackground(r, g, b, a)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    console.log(`Skip (no foreground): ${path.basename(filePath)}`);
    return;
  }

  minX = clamp(minX - PADDING, 0, width - 1);
  minY = clamp(minY - PADDING, 0, height - 1);
  maxX = clamp(maxX + PADDING, 0, width - 1);
  maxY = clamp(maxY + PADDING, 0, height - 1);

  const newW = maxX - minX + 1;
  const newH = maxY - minY + 1;
  const out = new PNG({ width: newW, height: newH });

  PNG.bitblt(png, out, minX, minY, newW, newH, 0, 0);
  fs.writeFileSync(filePath, PNG.sync.write(out));
  console.log(`Cropped: ${path.basename(filePath)} -> ${newW}x${newH}`);
}

function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => FILE_RE.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log('No case-xx.png files found.');
    return;
  }

  for (const f of files) {
    cropOne(path.join(DIR, f));
  }
  console.log(`Done. cropped files: ${files.length}`);
}

main();

