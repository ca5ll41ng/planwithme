// 生成应用图标 assets/icon.png(纯 Node,无第三方依赖)
// 图案:圆角方块渐变底 + 白色时钟(10:10)
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const SS = 3; // 3x3 超采样抗锯齿

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = (() => {
      const t = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })();
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = crc32.table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// 点到线段距离
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const gx = x1 + t * dx, gy = y1 + t * dy;
  return Math.hypot(px - gx, py - gy);
}

// 圆角矩形 SDF(负值在内部)
function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

const R = SIZE / 2;
const CORNER = 56;
const RING_R = 76, RING_W = 15;
const HAND_W = 13;

function sampleColor(px, py) {
  // 背景渐变 #6d7dff → #4a5cf0
  const gy = (py + R) / (2 * R);
  const bg = [Math.round(0x6d + (0x4a - 0x6d) * gy), Math.round(0x7d + (0x5c - 0x7d) * gy), 255];
  // 时钟
  const d = Math.hypot(px - R, py - R);
  const inRing = Math.abs(d - RING_R) < RING_W / 2;
  const inHand1 = distSeg(px, py, R, R, R - 40, R - 23) < HAND_W / 2;   // 时针(10点方向)
  const inHand2 = distSeg(px, py, R, R, R + 37, R - 22) < HAND_W / 2;   // 分针(2点方向)
  const inCenter = d < 10;
  const white = inRing || inHand1 || inHand2 || inCenter;
  return white ? [255, 255, 255] : bg;
}

const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let cr = 0, cg = 0, cb = 0, ca = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS - 0.5;
        const py = y + (sy + 0.5) / SS - 0.5;
        const sdf = roundedRectSDF(px, py, R, R, R - 2, R - 2, CORNER);
        const a = Math.max(0, Math.min(1, 0.5 - sdf)); // 1px 羽化
        if (a > 0) {
          const [r, g, b] = sampleColor(px, py);
          cr += r * a; cg += g * a; cb += b * a; ca += a;
        }
      }
    }
    const n = SS * SS;
    const i = (y * SIZE + x) * 4;
    if (ca > 0) {
      rgba[i] = Math.round(cr / ca);
      rgba[i + 1] = Math.round(cg / ca);
      rgba[i + 2] = Math.round(cb / ca);
      rgba[i + 3] = Math.round(255 * ca / n);
    }
  }
}

const out = path.join(__dirname, '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePNG(SIZE, SIZE, rgba));
console.log('图标已生成:', out);
