// 生成应用图标:assets/icon.png(256) + assets/icon.ico(16/32/48/256,供桌面快捷方式使用)
// 图案:圆角方块渐变底 + 白色时钟(10:10)
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

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
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

// 按尺寸渲染(所有几何随 k=S/256 线性缩放)
function drawIcon(S) {
  const k = S / 256;
  const R = S / 2, CORNER = 56 * k, RING_R = 76 * k, RING_W = 15 * k, HAND_W = 13 * k;
  const SS = S >= 64 ? 3 : 5;
  const rgba = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - 0.5;
          const py = y + (sy + 0.5) / SS - 0.5;
          const sdf = roundedRectSDF(px, py, R, R, R - 2 * k, R - 2 * k, CORNER);
          const a = Math.max(0, Math.min(1, 0.5 - sdf / 1));
          if (a > 0) {
            const gy = (py + R) / (2 * R);
            const d = Math.hypot(px - R, py - R);
            const white =
              Math.abs(d - RING_R) < RING_W / 2 ||
              distSeg(px, py, R, R, R - 40 * k, R - 23 * k) < HAND_W / 2 ||
              distSeg(px, py, R, R, R + 37 * k, R - 22 * k) < HAND_W / 2 ||
              d < 10 * k;
            const c = white ? [255, 255, 255]
              : [Math.round(0x6d + (0x4a - 0x6d) * gy), Math.round(0x7d + (0x5c - 0x7d) * gy), 255];
            cr += c[0] * a; cg += c[1] * a; cb += c[2] * a; ca += a;
          }
        }
      }
      const n = SS * SS, i = (y * S + x) * 4;
      if (ca > 0) {
        rgba[i] = Math.round(cr / ca);
        rgba[i + 1] = Math.round(cg / ca);
        rgba[i + 2] = Math.round(cb / ca);
        rgba[i + 3] = Math.round(255 * ca / n);
      }
    }
  }
  return rgba;
}

const assets = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'icon.png'), encodePNG(256, 256, drawIcon(256)));

// ---- ICO:头部 + 目录 + 各尺寸 PNG(PNG 压缩图标,Vista 起支持) ----
const sizes = [16, 32, 48, 256];
const pngs = sizes.map(s => encodePNG(s, s, drawIcon(s)));
const count = sizes.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
const entries = [];
let offset = 6 + 16 * count;
sizes.forEach((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s;
  e[2] = 0; e[3] = 0;
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  entries.push(e);
});
fs.writeFileSync(path.join(assets, 'icon.ico'), Buffer.concat([header, ...entries, ...pngs]));
console.log('已生成 assets/icon.png 和 assets/icon.ico');
