import zlib from 'zlib';
import fs from 'fs';

// --- PNG utilities ---
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const crc = u32(crc32(Buffer.concat([t, data])));
  return Buffer.concat([u32(data.length), t, data, crc]);
}

function buildPNG(width, height, rgba) {
  // rgba: Uint8Array of length width*height*4
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = 1 + x * 4;
      row[dst]     = rgba[src];
      row[dst + 1] = rgba[src + 1];
      row[dst + 2] = rgba[src + 2];
      row[dst + 3] = rgba[src + 3];
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const deflated = zlib.deflateSync(raw, { level: 9 });

  const ihdr = pngChunk('IHDR', Buffer.concat([
    u32(width), u32(height),
    Buffer.from([8, 6, 0, 0, 0]), // 8-bit RGBA
  ]));
  const idat = pngChunk('IDAT', deflated);
  const iend = pngChunk('IEND', Buffer.alloc(0));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// --- Drawing helpers ---
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Signed distance to a capsule (horizontal, centered at cx,cy)
// halfLen = half the length of the straight segment, radius = end radius
function sdCapsule(x, y, cx, cy, halfLen, radius) {
  const px = Math.abs(x - cx) - halfLen;
  const py = y - cy;
  return Math.sqrt(Math.max(px, 0) ** 2 + py ** 2) + Math.min(px, 0) - radius;
}

// Signed distance to a rounded rectangle
function sdRoundedRect(x, y, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(x - cx) - halfW + r;
  const qy = Math.abs(y - cy) - halfH + r;
  return Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2)
       + Math.min(Math.max(qx, qy), 0) - r;
}

// Linear interpolation between two RGBA colors
function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
    Math.round(c1[3] + (c2[3] - c1[3]) * t),
  ];
}

// --- Icon generator ---
function generatePillIcon(size) {
  const W = size, H = size;
  const rgba = new Uint8Array(W * H * 4);

  // Colors
  const transparent  = [0, 0, 0, 0];
  const bgColor      = [88, 110, 74, 255];   // sage green #586E4A
  const bgDark       = [62, 80, 50, 255];    // darker edge for bg gradient feel
  const pillLeft     = [220, 88, 88, 255];   // warm red  #DC5858
  const pillRight    = [245, 245, 245, 255]; // near-white
  const pillShadow   = [0, 0, 0, 60];        // subtle drop shadow
  const divider      = [180, 180, 180, 255];

  const cx = W / 2, cy = H / 2;

  // Background rounded square params
  const bgHalfW = W * 0.5 - 1;
  const bgHalfH = H * 0.5 - 1;
  const bgR = W * 0.22; // iOS-style corner radius (~22%)

  // Pill capsule params
  const pillRadius = H * 0.155;           // half-height of pill
  const pillHalfLen = W * 0.185;          // half straight segment
  const pillCx = cx, pillCy = cy;

  // Shadow offset
  const shadowOff = H * 0.025;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // --- Background layer ---
      const distBg = sdRoundedRect(x, y, cx, cy, bgHalfW, bgHalfH, bgR);
      const bgAlpha = clamp(-distBg + 0.5, 0, 1); // AA at edge

      // Subtle radial gradient on background (lighter center)
      const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (W * 0.5);
      const bgBlend = clamp(distFromCenter * 1.2, 0, 1);
      const bg = lerpColor(bgColor, bgDark, bgBlend * 0.4);

      let [r, g, b, a] = [bg[0], bg[1], bg[2], Math.round(bgAlpha * 255)];

      if (bgAlpha > 0) {
        // --- Pill shadow (drawn slightly offset, under pill) ---
        const distShadow = sdCapsule(x, y, pillCx, pillCy + shadowOff, pillHalfLen, pillRadius);
        const shadowAlpha = clamp(-distShadow + 1.5, 0, 1) * 0.45;

        // --- Pill shape ---
        const distPill = sdCapsule(x, y, pillCx, pillCy, pillHalfLen, pillRadius);
        const pillAlpha = clamp(-distPill + 0.5, 0, 1);

        if (shadowAlpha > 0 && pillAlpha < 1) {
          // blend shadow under pill
          const sa = shadowAlpha * (1 - pillAlpha);
          r = Math.round(r * (1 - sa) + pillShadow[0] * sa);
          g = Math.round(g * (1 - sa) + pillShadow[1] * sa);
          b = Math.round(b * (1 - sa) + pillShadow[2] * sa);
        }

        if (pillAlpha > 0) {
          // Determine pill color (left/right half + divider)
          let pc;
          const dividerWidth = pillRadius * 0.07;
          if (Math.abs(x - pillCx) < dividerWidth) {
            // Dividing line
            pc = divider;
          } else if (x < pillCx) {
            // Left half: slight sheen at top
            const sheen = clamp(1 - (y - (pillCy - pillRadius)) / (pillRadius * 0.6), 0, 1) * 0.15;
            pc = [
              Math.round(pillLeft[0] + (255 - pillLeft[0]) * sheen),
              Math.round(pillLeft[1] + (255 - pillLeft[1]) * sheen),
              Math.round(pillLeft[2] + (255 - pillLeft[2]) * sheen),
              255,
            ];
          } else {
            // Right half: slight sheen at top
            const sheen = clamp(1 - (y - (pillCy - pillRadius)) / (pillRadius * 0.6), 0, 1) * 0.12;
            pc = [
              Math.round(pillRight[0] - (pillRight[0] - 200) * (1 - sheen)),
              Math.round(pillRight[1] - (pillRight[1] - 200) * (1 - sheen)),
              Math.round(pillRight[2] - (pillRight[2] - 200) * (1 - sheen)),
              255,
            ];
            // Actually just lighten slightly at top
            pc = [
              Math.round(pillRight[0] * (0.88 + sheen * 0.12)),
              Math.round(pillRight[1] * (0.88 + sheen * 0.12)),
              Math.round(pillRight[2] * (0.88 + sheen * 0.12)),
              255,
            ];
          }

          // Blend pill over current pixel
          r = Math.round(r * (1 - pillAlpha) + pc[0] * pillAlpha);
          g = Math.round(g * (1 - pillAlpha) + pc[1] * pillAlpha);
          b = Math.round(b * (1 - pillAlpha) + pc[2] * pillAlpha);
        }
      }

      rgba[idx]     = clamp(r, 0, 255);
      rgba[idx + 1] = clamp(g, 0, 255);
      rgba[idx + 2] = clamp(b, 0, 255);
      rgba[idx + 3] = clamp(a, 0, 255);
    }
  }

  return buildPNG(W, H, rgba);
}

// --- Scale down 512→192 (2x2 box average) ---
function scaleDown(rgba512, srcSize, dstSize) {
  const scale = srcSize / dstSize;
  const out = new Uint8Array(dstSize * dstSize * 4);
  for (let dy = 0; dy < dstSize; dy++) {
    for (let dx = 0; dx < dstSize; dx++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(dx * scale), x1 = Math.ceil((dx + 1) * scale);
      const y0 = Math.floor(dy * scale), y1 = Math.ceil((dy + 1) * scale);
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * srcSize + sx) * 4;
          r += rgba512[i]; g += rgba512[i+1]; b += rgba512[i+2]; a += rgba512[i+3];
          n++;
        }
      }
      const oi = (dy * dstSize + dx) * 4;
      out[oi]   = Math.round(r / n);
      out[oi+1] = Math.round(g / n);
      out[oi+2] = Math.round(b / n);
      out[oi+3] = Math.round(a / n);
    }
  }
  return out;
}

// --- Main ---
const size512 = 512;
const rgba512 = (() => {
  const W = size512, H = size512;
  const rgba = new Uint8Array(W * H * 4);
  // Re-run pixel logic to get raw RGBA (reuse generatePillIcon internally)
  const pngBuf = generatePillIcon(size512);
  // We need raw RGBA — let's just keep them separate
  return null;
})();

// Generate 512 and extract raw pixels, then scale
// Simpler: generate both sizes directly
const png512 = generatePillIcon(512);
fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-512x512.png', png512);
console.log('✓ icon-512x512.png', png512.length, 'bytes');

const png192 = generatePillIcon(192);
fs.writeFileSync('public/icons/icon-192x192.png', png192);
console.log('✓ icon-192x192.png', png192.length, 'bytes');

console.log('Icone generate con successo!');
