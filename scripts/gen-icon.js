/**
 * Generates media/icon.png — a simple, dependency-free placeholder icon for
 * the Marketplace listing. Run with: node scripts/gen-icon.js
 *
 * Draws a 256x256 raster (navy panel, off-white "document" with an accent
 * header bar and ruled lines) and encodes it as a valid PNG using only the
 * Node `zlib` core module.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

const COLORS = {
  bg: [31, 78, 140], // navy
  page: [248, 249, 251], // off-white
  accent: [217, 154, 24], // amber header bar
  rule: [198, 202, 212], // grey ruled lines
};

/** Return the pixel color [r,g,b] for a given coordinate. */
function pixelAt(x, y) {
  // Rounded-corner navy background.
  const r = 36;
  const inCorner =
    (x < r && y < r && (x - r) ** 2 + (y - r) ** 2 > r * r) ||
    (x >= SIZE - r && y < r && (x - (SIZE - r)) ** 2 + (y - r) ** 2 > r * r) ||
    (x < r && y >= SIZE - r && (x - r) ** 2 + (y - (SIZE - r)) ** 2 > r * r) ||
    (x >= SIZE - r &&
      y >= SIZE - r &&
      (x - (SIZE - r)) ** 2 + (y - (SIZE - r)) ** 2 > r * r);
  if (inCorner) {
    return null; // transparent
  }

  // Document panel.
  const px0 = 64;
  const px1 = 192;
  const py0 = 52;
  const py1 = 204;
  if (x >= px0 && x < px1 && y >= py0 && y < py1) {
    // Amber header bar.
    if (y < py0 + 30) {
      return COLORS.accent;
    }
    // Ruled text lines.
    const lineSpacing = 22;
    const offsetY = y - (py0 + 48);
    if (offsetY >= 0 && offsetY % lineSpacing < 8 && x > px0 + 16 && x < px1 - 16) {
      return COLORS.rule;
    }
    return COLORS.page;
  }

  return COLORS.bg;
}

/** Build the raw RGBA scanline buffer with a leading filter byte per row. */
function buildRaw() {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  let offset = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < SIZE; x++) {
      const color = pixelAt(x, y);
      if (color === null) {
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
      } else {
        raw[offset++] = color[0];
        raw[offset++] = color[1];
        raw[offset++] = color[2];
        raw[offset++] = 255;
      }
    }
  }
  return raw;
}

/** Wrap data in a PNG chunk (length + type + data + CRC32). */
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

/** Standard CRC32 used by the PNG format. */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return crc ^ 0xffffffff;
}

function main() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(buildRaw(), { level: 9 });

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  const outDir = path.join(__dirname, '..', 'media');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'icon.png');
  fs.writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}

main();
