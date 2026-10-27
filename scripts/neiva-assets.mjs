import zlib from "node:zlib";
import crypto from "node:crypto";

/**
 * Generadores originales de imágenes y modelos 3D para la semilla de Neiva.
 * No descarga assets de terceros: los pósters se dibujan píxel a píxel y los
 * GLB se construyen como mallas low-poly.
 */

export const NEIVA_CENTER = { lat: 2.9345, lng: -75.2809 };

const PALETTES = [
  ["#0b1727", "#1d3557", "#e76f51", "#f4a261"],
  ["#132a13", "#31572c", "#90a955", "#ecf39e"],
  ["#2b2d42", "#8d99ae", "#ef233c", "#edf2f4"],
  ["#3d0c02", "#7f2b0a", "#d9822b", "#f2e3c6"],
  ["#001219", "#005f73", "#ee9b00", "#e9d8a6"],
  ["#231942", "#5e548e", "#e0b1cb", "#f5e6f8"],
  ["#03045e", "#0077b6", "#90e0ef", "#caf0f8"],
  ["#283618", "#606c38", "#dda15e", "#fefae0"],
];

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FONT = {
  N: ["10001", "11001", "10101", "10011", "10001"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "11111"],
  V: ["10001", "10001", "10001", "01010", "00100"],
  A: ["01110", "10001", "11111", "10001", "10001"],
  H: ["10001", "10001", "11111", "10001", "10001"],
  U: ["10001", "10001", "10001", "10001", "11111"],
  L: ["10000", "10000", "10000", "10000", "11111"],
  "0": ["01110", "10011", "10101", "11001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00110", "01000", "11111"],
  "3": ["11110", "00001", "01110", "00001", "11110"],
  "4": ["00010", "00110", "01010", "11111", "00010"],
  "5": ["11111", "10000", "11110", "00001", "11110"],
  "6": ["01110", "10000", "11110", "10001", "01110"],
  "7": ["11111", "00010", "00100", "01000", "01000"],
  "8": ["01110", "10001", "01110", "10001", "01110"],
  "9": ["01110", "10001", "01111", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000"],
};

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 3);
  }

  set(x, y, color) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const offset = (yi * this.width + xi) * 3;
    this.pixels[offset] = color[0];
    this.pixels[offset + 1] = color[1];
    this.pixels[offset + 2] = color[2];
  }

  blend(x, y, color, alpha = 0.5) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const offset = (yi * this.width + xi) * 3;
    this.pixels[offset] = Math.round(this.pixels[offset] * (1 - alpha) + color[0] * alpha);
    this.pixels[offset + 1] = Math.round(this.pixels[offset + 1] * (1 - alpha) + color[1] * alpha);
    this.pixels[offset + 2] = Math.round(this.pixels[offset + 2] * (1 - alpha) + color[2] * alpha);
  }

  rect(x, y, width, height, color, alpha = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + width));
    const y1 = Math.min(this.height, Math.round(y + height));
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) {
        if (alpha >= 1) this.set(xx, yy, color);
        else this.blend(xx, yy, color, alpha);
      }
    }
  }

  circle(cx, cy, radius, color, alpha = 1) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          if (alpha >= 1) this.set(x, y, color);
          else this.blend(x, y, color, alpha);
        }
      }
    }
  }

  polygon(points, color, alpha = 1) {
    if (points.length < 3) return;
    const ys = points.map((point) => point[1]);
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y += 1) {
      const intersections = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          intersections.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const xStart = Math.max(0, Math.ceil(intersections[i]));
        const xEnd = Math.min(this.width - 1, Math.floor(intersections[i + 1]));
        for (let x = xStart; x <= xEnd; x += 1) {
          if (alpha >= 1) this.set(x, y, color);
          else this.blend(x, y, color, alpha);
        }
      }
    }
  }

  thickArc(cx, cy, radius, thickness, color, startAngle = Math.PI, endAngle = 0) {
    const steps = Math.max(24, Math.round(radius * 1.5));
    for (let i = 0; i <= steps; i += 1) {
      const angle = startAngle + ((endAngle - startAngle) * i) / steps;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      this.circle(x, y, thickness / 2, color);
    }
  }

  text(value, x, y, scale, color) {
    let cursor = x;
    for (const character of String(value).toUpperCase()) {
      const glyph = FONT[character] || FONT[" "];
      for (let row = 0; row < glyph.length; row += 1) {
        for (let col = 0; col < glyph[row].length; col += 1) {
          if (glyph[row][col] === "1") {
            this.rect(cursor + col * scale, y + row * scale, scale, scale, color);
          }
        }
      }
      cursor += 6 * scale;
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function encodePng(canvas) {
  const { width, height, pixels } = canvas;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolor RGB
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rowLength = width * 3;
  const raw = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowLength + 1)] = 0;
    pixels.copy(raw, y * (rowLength + 1) + 1, y * rowLength, (y + 1) * rowLength);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawLandmark(canvas, variant, dark, accent, width, height) {
  const cx = width * 0.5;
  const base = height * 0.78;
  const unit = width / 100;

  switch (variant % 12) {
    case 0: {
      canvas.rect(cx - 9 * unit, base - 4 * unit, 18 * unit, 4 * unit, dark);
      canvas.polygon(
        [
          [cx - 6 * unit, base - 4 * unit],
          [cx - 3 * unit, base - 34 * unit],
          [cx + 3 * unit, base - 34 * unit],
          [cx + 6 * unit, base - 4 * unit],
        ],
        dark,
      );
      canvas.circle(cx, base - 36 * unit, 2.2 * unit, accent);
      break;
    }
    case 1: {
      canvas.rect(cx - 16 * unit, base - 22 * unit, 32 * unit, 22 * unit, dark);
      canvas.rect(cx + 10 * unit, base - 40 * unit, 11 * unit, 40 * unit, dark);
      canvas.polygon(
        [
          [cx + 9 * unit, base - 40 * unit],
          [cx + 15.5 * unit, base - 48 * unit],
          [cx + 22 * unit, base - 40 * unit],
        ],
        dark,
      );
      canvas.rect(cx + 14.6 * unit, base - 54 * unit, 1.8 * unit, 6 * unit, accent);
      canvas.rect(cx + 12.5 * unit, base - 52 * unit, 6 * unit, 1.8 * unit, accent);
      break;
    }
    case 2: {
      canvas.rect(cx - 34 * unit, base - 18 * unit, 68 * unit, 4 * unit, dark);
      canvas.rect(cx - 30 * unit, base - 18 * unit, 6 * unit, 18 * unit, dark);
      canvas.rect(cx + 24 * unit, base - 18 * unit, 6 * unit, 18 * unit, dark);
      canvas.thickArc(cx, base - 18 * unit, 18 * unit, 4 * unit, dark);
      break;
    }
    case 3: {
      canvas.polygon(
        [
          [cx - 42 * unit, base],
          [cx - 38 * unit, base - 34 * unit],
          [cx - 20 * unit, base - 38 * unit],
          [cx - 14 * unit, base - 16 * unit],
          [cx - 10 * unit, base],
        ],
        dark,
      );
      canvas.polygon(
        [
          [cx + 42 * unit, base],
          [cx + 38 * unit, base - 34 * unit],
          [cx + 20 * unit, base - 38 * unit],
          [cx + 14 * unit, base - 16 * unit],
          [cx + 10 * unit, base],
        ],
        dark,
      );
      canvas.thickArc(cx, base - 13 * unit, 12 * unit, 3 * unit, dark);
      break;
    }
    case 4: {
      canvas.polygon(
        [
          [cx - 44 * unit, base],
          [cx - 40 * unit, base - 30 * unit],
          [cx - 8 * unit, base - 36 * unit],
          [cx - 4 * unit, base],
        ],
        dark,
      );
      canvas.polygon(
        [
          [cx + 44 * unit, base],
          [cx + 40 * unit, base - 26 * unit],
          [cx + 8 * unit, base - 32 * unit],
          [cx + 4 * unit, base],
        ],
        dark,
      );
      canvas.rect(cx - 6 * unit, base - 34 * unit, 12 * unit, 34 * unit, accent, 0.85);
      for (let i = 0; i < 8; i += 1) {
        canvas.circle(cx - 2 * unit + (i % 3) * 2 * unit, base - 6 * unit - i * 3.4 * unit, 0.9 * unit, [255, 255, 255], 0.8);
      }
      break;
    }
    case 5: {
      canvas.rect(cx - 3 * unit, base - 26 * unit, 6 * unit, 26 * unit, dark);
      canvas.rect(cx - 14 * unit, base - 20 * unit, 5 * unit, 12 * unit, dark);
      canvas.rect(cx - 14 * unit, base - 12 * unit, 11 * unit, 4 * unit, dark);
      canvas.rect(cx + 9 * unit, base - 26 * unit, 5 * unit, 14 * unit, dark);
      canvas.rect(cx + 3 * unit, base - 16 * unit, 11 * unit, 4 * unit, dark);
      break;
    }
    case 6: {
      canvas.rect(cx - 22 * unit, base - 18 * unit, 44 * unit, 18 * unit, dark);
      canvas.polygon(
        [
          [cx - 26 * unit, base - 18 * unit],
          [cx, base - 32 * unit],
          [cx + 26 * unit, base - 18 * unit],
        ],
        dark,
      );
      canvas.rect(cx - 5 * unit, base - 12 * unit, 10 * unit, 12 * unit, accent);
      canvas.rect(cx - 16 * unit, base - 13 * unit, 6 * unit, 6 * unit, accent, 0.7);
      canvas.rect(cx + 10 * unit, base - 13 * unit, 6 * unit, 6 * unit, accent, 0.7);
      break;
    }
    case 7: {
      canvas.rect(cx - 30 * unit, base - 8 * unit, 60 * unit, 8 * unit, dark);
      canvas.rect(cx - 28 * unit, base - 32 * unit, 56 * unit, 4 * unit, dark);
      canvas.polygon(
        [
          [cx - 32 * unit, base - 32 * unit],
          [cx, base - 42 * unit],
          [cx + 32 * unit, base - 32 * unit],
        ],
        dark,
      );
      for (let i = -3; i <= 3; i += 1) {
        canvas.rect(cx + i * 7 * unit - 1.4 * unit, base - 28 * unit, 2.8 * unit, 20 * unit, dark);
      }
      break;
    }
    case 8: {
      for (let i = 0; i < 7; i += 1) {
        const angle = Math.PI + (Math.PI * i) / 6;
        const x = cx + Math.cos(angle) * 20 * unit;
        const y = base - 30 * unit + Math.sin(angle) * 9 * unit;
        canvas.thickArc(cx, base - 30 * unit, 20 * unit, 5 * unit, dark, angle - 0.2, angle + 0.2);
        canvas.circle(x, y, 2 * unit, dark);
      }
      canvas.rect(cx - 2 * unit, base - 30 * unit, 4 * unit, 30 * unit, dark);
      break;
    }
    case 9: {
      canvas.polygon(
        [
          [cx - 28 * unit, base - 6 * unit],
          [cx - 20 * unit, base - 14 * unit],
          [cx + 20 * unit, base - 14 * unit],
          [cx + 28 * unit, base - 6 * unit],
        ],
        dark,
      );
      canvas.rect(cx - 8 * unit, base - 24 * unit, 16 * unit, 10 * unit, dark);
      canvas.rect(cx - 0.8 * unit, base - 40 * unit, 1.6 * unit, 16 * unit, dark);
      canvas.polygon(
        [
          [cx + 0.8 * unit, base - 40 * unit],
          [cx + 13 * unit, base - 30 * unit],
          [cx + 0.8 * unit, base - 24 * unit],
        ],
        accent,
        0.8,
      );
      break;
    }
    case 10: {
      canvas.circle(cx, base - 16 * unit, 16 * unit, dark);
      canvas.rect(cx - 20 * unit, base - 16 * unit, 40 * unit, 16 * unit, dark);
      canvas.rect(cx - 3 * unit, base - 18 * unit, 6 * unit, 18 * unit, accent);
      for (let i = 0; i < 12; i += 1) {
        const x = cx - 40 * unit + (i * 80 * unit) / 11;
        const y = base - 48 * unit + Math.sin(i * 1.7) * 8 * unit;
        canvas.circle(x, y, 1.1 * unit, [255, 255, 255], 0.85);
      }
      break;
    }
    default: {
      canvas.circle(cx, base - 8 * unit, 26 * unit, dark);
      canvas.circle(cx, base - 8 * unit, 20 * unit, accent, 0.35);
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI * 2 * i) / 10;
        canvas.rect(
          cx + Math.cos(angle) * 22 * unit - 1.5 * unit,
          base - 8 * unit + Math.sin(angle) * 22 * unit - 6 * unit,
          3 * unit,
          6 * unit,
          dark,
        );
      }
      canvas.rect(cx - 2 * unit, base - 40 * unit, 4 * unit, 30 * unit, dark);
      break;
    }
  }
}

export function makePosterPng(index) {
  const width = 960;
  const height = 640;
  const canvas = new Canvas(width, height);
  const palette = PALETTES[index % PALETTES.length].map(hexToRgb);
  const random = mulberry32(index * 7919 + 17);
  const variant = index % 12;
  const accent = palette[2];
  const dark = mix(palette[0], [8, 10, 14], 0.55);

  for (let y = 0; y < height; y += 1) {
    const t = y / height;
    const color = mix(palette[0], palette[1], t * 0.85 + 0.05);
    canvas.rect(0, y, width, 1, color);
  }

  // Sol / luna
  const sunX = width * (0.2 + ((index * 37) % 60) / 100);
  const sunY = height * (0.16 + ((index * 19) % 12) / 100);
  canvas.circle(sunX, sunY, 46 + (index % 4) * 8, accent, 0.9);
  canvas.circle(sunX, sunY, 30 + (index % 4) * 6, mix(accent, [255, 255, 255], 0.45), 0.7);

  // Estrellas tenues
  for (let i = 0; i < 70; i += 1) {
    const x = random() * width;
    const y = random() * height * 0.5;
    canvas.blend(x, y, [255, 255, 255], 0.25 + random() * 0.5);
  }

  // Montañas en capas
  const layers = 3;
  for (let layer = 0; layer < layers; layer += 1) {
    const color = mix(palette[1], dark, 0.2 + layer * 0.22);
    const baseline = height * (0.55 + layer * 0.08);
    const points = [[0, height], [0, baseline]];
    const peaks = 5 + layer;
    for (let i = 0; i <= peaks; i += 1) {
      const x = (width * i) / peaks;
      const peak = baseline - (60 + random() * 120) * (1 - layer * 0.18);
      points.push([x, i % 2 === 0 ? baseline - random() * 24 : peak]);
    }
    points.push([width, height]);
    canvas.polygon(points, color);
  }

  // Río Magdalena
  const river = mix(palette[1], accent, 0.42);
  canvas.polygon(
    [
      [0, height],
      [width * 0.08, height * 0.78],
      [width * 0.34, height * 0.82],
      [width * 0.58, height * 0.75],
      [width * 0.86, height * 0.82],
      [width, height * 0.77],
      [width, height],
    ],
    river,
  );
  for (let i = 0; i < 16; i += 1) {
    const y = height * 0.8 + random() * height * 0.17;
    const x = random() * width;
    canvas.rect(x, y, 30 + random() * 90, 2, mix(river, [255, 255, 255], 0.55), 0.45);
  }

  drawLandmark(canvas, variant, dark, accent, width, height);

  // Marco y marca
  const border = mix([255, 255, 255], accent, 0.25);
  canvas.rect(24, 24, width - 48, 2, border, 0.55);
  canvas.rect(24, height - 26, width - 48, 2, border, 0.55);
  canvas.rect(24, 24, 2, height - 48, border, 0.55);
  canvas.rect(width - 26, 24, 2, height - 48, border, 0.55);
  canvas.text("NEIVA", 44, 48, 6, [255, 255, 255]);
  canvas.text(String(index + 1).padStart(2, "0"), width - 92, 48, 6, accent);

  return encodePng(canvas);
}

/* ── GLB low-poly ─────────────────────────────────────────────────────────── */

function colorOf(hex) {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255, 1];
}

function pushQuad(out, a, b, c, d, normal) {
  const base = out.positions.length / 3;
  out.positions.push(...a, ...b, ...c, ...d);
  for (let i = 0; i < 4; i += 1) out.normals.push(...normal);
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function box(out, center, size, color) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map((value) => value / 2);
  const faces = [
    { n: [1, 0, 0], p: [[sx, -sy, -sz], [sx, -sy, sz], [sx, sy, sz], [sx, sy, -sz]] },
    { n: [-1, 0, 0], p: [[-sx, -sy, sz], [-sx, -sy, -sz], [-sx, sy, -sz], [-sx, sy, sz]] },
    { n: [0, 1, 0], p: [[-sx, sy, -sz], [sx, sy, -sz], [sx, sy, sz], [-sx, sy, sz]] },
    { n: [0, -1, 0], p: [[-sx, -sy, sz], [sx, -sy, sz], [sx, -sy, -sz], [-sx, -sy, -sz]] },
    { n: [0, 0, 1], p: [[-sx, -sy, sz], [sx, -sy, sz], [sx, sy, sz], [-sx, sy, sz]] },
    { n: [0, 0, -1], p: [[sx, -sy, -sz], [-sx, -sy, -sz], [-sx, sy, -sz], [sx, sy, -sz]] },
  ];
  for (const face of faces) {
    pushQuad(
      out,
      ...face.p.map(([x, y, z]) => [cx + x, cy + y, cz + z]),
      face.n,
    );
  }
  out.colors.push(color);
}

function cylinder(out, center, radiusBottom, radiusTop, heightValue, segments, color) {
  const [cx, cy, cz] = center;
  const bottom = cy - heightValue / 2;
  const top = cy + heightValue / 2;
  for (let i = 0; i < segments; i += 1) {
    const a0 = (Math.PI * 2 * i) / segments;
    const a1 = (Math.PI * 2 * (i + 1)) / segments;
    const x0b = cx + Math.cos(a0) * radiusBottom;
    const z0b = cz + Math.sin(a0) * radiusBottom;
    const x1b = cx + Math.cos(a1) * radiusBottom;
    const z1b = cz + Math.sin(a1) * radiusBottom;
    const x0t = cx + Math.cos(a0) * radiusTop;
    const z0t = cz + Math.sin(a0) * radiusTop;
    const x1t = cx + Math.cos(a1) * radiusTop;
    const z1t = cz + Math.sin(a1) * radiusTop;
    const nx = Math.cos((a0 + a1) / 2);
    const nz = Math.sin((a0 + a1) / 2);
    pushQuad(out, [x0b, bottom, z0b], [x1b, bottom, z1b], [x1t, top, z1t], [x0t, top, z0t], [nx, 0, nz]);
  }
  // Tapas
  out.positions.push(cx, top, cz);
  out.normals.push(0, 1, 0);
  const topCenter = out.positions.length / 3 - 1;
  for (let i = 0; i < segments; i += 1) {
    const a0 = (Math.PI * 2 * i) / segments;
    const a1 = (Math.PI * 2 * (i + 1)) / segments;
    out.positions.push(cx + Math.cos(a0) * radiusTop, top, cz + Math.sin(a0) * radiusTop);
    out.positions.push(cx + Math.cos(a1) * radiusTop, top, cz + Math.sin(a1) * radiusTop);
    out.normals.push(0, 1, 0, 0, 1, 0);
    out.indices.push(topCenter, topCenter + i * 2 + 1, topCenter + i * 2 + 2);
  }
  out.colors.push(color);
}

function partColorOut() {
  return { positions: [], normals: [], indices: [], colors: [] };
}

const GLB_COLORS = [
  "#e76f51",
  "#f4a261",
  "#2a9d8f",
  "#264653",
  "#e9c46a",
  "#8ab17d",
  "#bc6c25",
  "#6d597a",
  "#457b9d",
  "#b56576",
  "#3a86ff",
  "#ffb703",
];

export function makeLandmarkGlb(index) {
  const parts = [];
  const c = (offset = 0) => colorOf(GLB_COLORS[(index + offset) % GLB_COLORS.length]);

  const add = (builder) => {
    const out = partColorOut();
    builder(out);
    parts.push(out);
  };

  switch (index % 12) {
    case 0: // Obelisco
      add((out) => box(out, [0, 0.2, 0], [3, 0.4, 3], c(3)));
      add((out) => cylinder(out, [0, 2.2, 0], 0.9, 0.35, 3.6, 4, c(0)));
      add((out) => cylinder(out, [0, 4.3, 0], 0.35, 0.02, 0.8, 4, c(1)));
      break;
    case 1: // Iglesia
      add((out) => box(out, [0, 1.2, 0], [5, 2.4, 7], c(3)));
      add((out) => box(out, [1.8, 3, 1.6], [2, 4, 2], c(4)));
      add((out) => cylinder(out, [1.8, 5.2, 1.6], 1.4, 0.02, 1.4, 4, c(0)));
      add((out) => box(out, [1.8, 6.2, 1.6], [0.18, 1.4, 0.18], c(1)));
      add((out) => box(out, [1.8, 6.35, 1.6], [0.9, 0.18, 0.18], c(1)));
      break;
    case 2: // Puente
      add((out) => box(out, [0, 2.6, 0], [12, 0.45, 2.4], c(2)));
      add((out) => box(out, [-4.6, 1.3, 0], [0.9, 2.6, 2.8], c(3)));
      add((out) => box(out, [4.6, 1.3, 0], [0.9, 2.6, 2.8], c(3)));
      add((out) => box(out, [0, 1.4, 0], [8, 0.3, 2.2], c(4)));
      add((out) => cylinder(out, [0, 1.35, 1.35], 3.8, 3.8, 0.25, 16, c(1)));
      break;
    case 3: // Cañón
      add((out) => box(out, [-3.4, 2.2, 0], [2.4, 4.4, 5], c(3)));
      add((out) => box(out, [3.4, 2.6, 0], [2.4, 5.2, 5], c(3)));
      add((out) => box(out, [0, 4.8, 0], [9.2, 0.8, 4.2], c(0)));
      add((out) => box(out, [0, 0.35, 0], [4.4, 0.7, 5.2], c(1)));
      break;
    case 4: // Cascada
      add((out) => box(out, [-3.8, 2.6, 0], [2.6, 5.2, 5], c(3)));
      add((out) => box(out, [3.8, 2.2, 0], [2.6, 4.4, 5], c(3)));
      add((out) => box(out, [0, 2.4, 0], [2.4, 4.8, 4], c(2)));
      add((out) => box(out, [0, 0.25, 0], [7, 0.5, 6], c(1)));
      break;
    case 5: // Cactus
      add((out) => cylinder(out, [0, 2.2, 0], 0.45, 0.4, 4.4, 8, c(2)));
      add((out) => cylinder(out, [-1, 2.8, 0], 0.3, 0.28, 1.6, 8, c(2)));
      add((out) => cylinder(out, [1, 3.2, 0], 0.3, 0.28, 1.4, 8, c(2)));
      add((out) => box(out, [-1.45, 2.8, 0], [0.9, 0.4, 0.4], c(2)));
      add((out) => box(out, [1.45, 3.2, 0], [0.9, 0.4, 0.4], c(2)));
      break;
    case 6: // Casa colonial
      add((out) => box(out, [0, 1.5, 0], [6, 3, 5], c(3)));
      add((out) => cylinder(out, [0, 3.6, 0], 4.2, 0.02, 1.4, 4, c(0)));
      add((out) => box(out, [0, 0.9, 2.55], [1.1, 1.8, 0.15], c(1)));
      add((out) => box(out, [-2, 1.8, 2.55], [0.9, 0.9, 0.15], c(4)));
      add((out) => box(out, [2, 1.8, 2.55], [0.9, 0.9, 0.15], c(4)));
      break;
    case 7: // Museo
      add((out) => box(out, [0, 0.3, 0], [10, 0.6, 7], c(3)));
      add((out) => box(out, [0, 3.4, 0], [10, 0.5, 7], c(4)));
      for (let i = -4; i <= 4; i += 2) {
        add((out) => cylinder(out, [i, 1.9, 2.8], 0.25, 0.25, 2.6, 10, c(1)));
      }
      add((out) => cylinder(out, [0, 4.2, 0], 5.4, 0.02, 1.2, 4, c(0)));
      break;
    case 8: // Palma
      add((out) => cylinder(out, [0, 2.6, 0], 0.3, 0.2, 5.2, 8, c(3)));
      for (let i = 0; i < 7; i += 1) {
        const angle = (Math.PI * 2 * i) / 7;
        add((out) =>
          box(out, [Math.cos(angle) * 1.4, 5.2, Math.sin(angle) * 1.4], [2.8, 0.18, 0.7], c(2)),
        );
      }
      add((out) => box(out, [0, 0.2, 0], [3, 0.4, 3], c(1)));
      break;
    case 9: // Lancha
      add((out) => box(out, [0, 0.6, 0], [7, 0.8, 2.6], c(3)));
      add((out) => box(out, [0, 0.25, 0], [5.6, 0.5, 2], c(1)));
      add((out) => box(out, [0.6, 1.4, 0], [2.4, 1.2, 2], c(4)));
      add((out) => box(out, [-2.2, 1.9, 0], [0.16, 2.2, 0.16], c(2)));
      add((out) => box(out, [-1.5, 2.6, 0], [1.4, 0.7, 0.1], c(0)));
      break;
    case 10: // Observatorio
      add((out) => box(out, [0, 0.7, 0], [6, 1.4, 6], c(3)));
      add((out) => cylinder(out, [0, 1.9, 0], 2.8, 2.2, 1.4, 16, c(4)));
      add((out) => cylinder(out, [0, 2.7, 0], 0.35, 0.08, 1.2, 10, c(1)));
      add((out) => cylinder(out, [2.2, 3.4, 1.2], 0.18, 0.18, 0.8, 8, c(0)));
      break;
    default: // Plaza
      add((out) => cylinder(out, [0, 0.2, 0], 4.4, 4.4, 0.4, 24, c(3)));
      add((out) => cylinder(out, [0, 1.4, 0], 0.3, 0.3, 2, 10, c(1)));
      add((out) => cylinder(out, [0, 3.2, 0], 0.6, 0.04, 1.8, 4, c(0)));
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        add((out) =>
          cylinder(out, [Math.cos(angle) * 3.6, 1, Math.sin(angle) * 3.6], 0.18, 0.18, 1.6, 8, c(4)),
        );
      }
      break;
  }

  // Construir buffer y accesores
  const chunks = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const primitives = [];
  const materials = [];

  const align4 = (value) => (value + 3) & ~3;

  for (let p = 0; p < parts.length; p += 1) {
    const part = parts[p];
    const positions = Float32Array.from(part.positions);
    const normals = Float32Array.from(part.normals);
    const indices = Uint16Array.from(part.indices);
    const positionBuffer = Buffer.from(positions.buffer);
    const normalBuffer = Buffer.from(normals.buffer);
    const indexBuffer = Buffer.from(indices.buffer);

    const positionView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: positionBuffer.length, target: 34962 });
    chunks.push(positionBuffer);
    offset = align4(offset + positionBuffer.length);
    if (offset > chunks.reduce((sum, chunk) => sum + chunk.length, 0)) {
      chunks.push(Buffer.alloc(offset - chunks.reduce((sum, chunk) => sum + chunk.length, 0)));
    }

    const normalView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: normalBuffer.length, target: 34962 });
    chunks.push(normalBuffer);
    offset = align4(offset + normalBuffer.length);
    if (offset > chunks.reduce((sum, chunk) => sum + chunk.length, 0)) {
      chunks.push(Buffer.alloc(offset - chunks.reduce((sum, chunk) => sum + chunk.length, 0)));
    }

    const indexView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: indexBuffer.length, target: 34963 });
    chunks.push(indexBuffer);
    offset = align4(offset + indexBuffer.length);
    if (offset > chunks.reduce((sum, chunk) => sum + chunk.length, 0)) {
      chunks.push(Buffer.alloc(offset - chunks.reduce((sum, chunk) => sum + chunk.length, 0)));
    }

    const positionAccessor = accessors.length;
    accessors.push({
      bufferView: positionView,
      componentType: 5126,
      count: positions.length / 3,
      type: "VEC3",
      min: [Math.min(...part.positions.filter((_, i) => i % 3 === 0)), Math.min(...part.positions.filter((_, i) => i % 3 === 1)), Math.min(...part.positions.filter((_, i) => i % 3 === 2))],
      max: [Math.max(...part.positions.filter((_, i) => i % 3 === 0)), Math.max(...part.positions.filter((_, i) => i % 3 === 1)), Math.max(...part.positions.filter((_, i) => i % 3 === 2))],
    });
    const normalAccessor = accessors.length;
    accessors.push({
      bufferView: normalView,
      componentType: 5126,
      count: normals.length / 3,
      type: "VEC3",
    });
    const indexAccessor = accessors.length;
    accessors.push({
      bufferView: indexView,
      componentType: 5123,
      count: indices.length,
      type: "SCALAR",
    });

    const materialIndex = materials.length;
    materials.push({
      name: `material-${p}`,
      pbrMetallicRoughness: {
        baseColorFactor: part.colors[0] || [1, 1, 1, 1],
        metallicFactor: 0.05,
        roughnessFactor: 0.82,
      },
    });
    primitives.push({
      attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: materialIndex,
    });
  }

  const binary = Buffer.concat(chunks);
  const json = {
    asset: { version: "2.0", generator: "ViaNova Neiva low-poly generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: `Neiva landmark ${index + 1}` }],
    meshes: [{ primitives }],
    materials,
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors,
  };

  let jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
  if (jsonPadding) jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
  const binPadding = (4 - (binary.length % 4)) % 4;
  const binBuffer = binPadding ? Buffer.concat([binary, Buffer.alloc(binPadding)]) : binary;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.length + 8 + binBuffer.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]);
}

/* ── Imágenes reales de Internet (reemplaza los pósters generados por IA) ── */

/* Fotos reales de Unsplash, una por categoría (hotel / restaurante /
   recreación). Se trae cada URL con Cloudinary y se guarda como asset propio.
   Las 36 URLs únicas cubren 12 servicios + 12 productos de cada categoría
   (72 slots en total). Si alguna URL falla, se usa FALLBACK_URL para que el
   seed nunca se rompa. */
const FALLBACK_URL =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80";

const HOTEL_IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
  "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1200&q=80",
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80",
  // Rotación de fotos validadas para completar 12 servicios/productos hotel
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
  "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1200&q=80",
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80",
];

const RESTAURANT_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80",
  "https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=1200&q=80",
  "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=1200&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200&q=80",
  "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1200&q=80",
  // Rotación de fotos validadas para completar 12 servicios/productos restaurant
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80",
];

const RECREATION_IMAGES = [
  "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1200&q=80",
  "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80",
  "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80",
  "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80",
  "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80",
];

// 72 slots: 12 servicios hotel, 12 servicios restaurant, 12 servicios recreation,
// 12 productos hotel, 12 productos restaurant, 12 productos recreation.
export const NEIVA_IMAGE_URLS = [
  ...HOTEL_IMAGES, // 0-11  servicios hotel
  ...RESTAURANT_IMAGES, // 12-23 servicios restaurant
  ...RECREATION_IMAGES, // 24-35 servicios recreation
  ...HOTEL_IMAGES, // 36-47 productos hotel
  ...RESTAURANT_IMAGES, // 48-59 productos restaurant
  ...RECREATION_IMAGES, // 60-71 productos recreation
];

export { FALLBACK_URL };

/* ── Datos de la semilla ─────────────────────────────────────────────────── */

const hotelSeeds = [
  ["Hotel Centro Histórico Neiva", "Casona restaurada a dos cuadras del Parque Santander, con patio interior, desayuno opita y terraza.", 265000, 5, 2.9372, -75.2815, "Check-in 15:00 · Check-out 12:00"],
  ["Hotel Río Magdalena", "Habitaciones con balcón frente al malecón del Magdalena, piscina y restaurante de autor.", 390000, 5, 2.9278, -75.2872, "Check-in 15:00 · Check-out 13:00"],
  ["Hostería Casa de Guadua", "Refugio de guadua rodeado de jardines, ideal para descansar y trabajar con wifi de fibra.", 215000, 4, 2.9456, -75.2968, "Check-in 14:00 · Check-out 12:00"],
  ["Hotel Mirador del Huila", "Vista panorámica a la ciudad y a la cordillera, bar en la azotea y habitaciones familiares.", 410000, 5, 2.9521, -75.2742, "Check-in 15:00 · Check-out 12:00"],
  ["Hotel Plaza Neiva", "Ubicación central para negocios, salas de reuniones, gimnasio y desayuno buffet.", 295000, 4, 2.9341, -75.2788, "Check-in 15:00 · Check-out 12:00"],
  ["Apartahotel Las Ceibas", "Apartamentos equipados con cocina, lavandería y parqueadero para estancias largas.", 340000, 5, 2.9196, -75.2896, "Check-in 14:00 · Check-out 11:00"],
  ["Hotel EcoCampus Neiva", "Alojamiento sostenible con paneles solares, huerta y bicicletas de cortesía.", 245000, 4, 2.9604, -75.2684, "Check-in 15:00 · Check-out 12:00"],
  ["Posada El Cedro", "Posada familiar de diez habitaciones, cocina compartida y ambiente tranquilo.", 145000, 4, 2.9289, -75.2711, "Check-in 13:00 · Check-out 11:00"],
  ["Hotel Bahía Conquistador", "Hotel clásico con piscina, sauna, restaurante y salón de eventos.", 320000, 5, 2.9412, -75.2849, "Check-in 15:00 · Check-out 12:00"],
  ["Hotel Tatacoa Star", "Base de exploración para el desierto, con observatorio, telescopios y noches de estrellas.", 280000, 5, 3.2302, -75.1615, "Check-in 14:00 · Check-out 11:00"],
  ["Hostería Agua de Coco", "Hostería campestre con piscina natural, senderos y comida de la región.", 230000, 4, 2.7804, -75.2596, "Check-in 15:00 · Check-out 12:00"],
  ["Hotel La Vorágine", "Boutique literario en el centro, biblioteca, café y habitaciones temáticas.", 305000, 5, 2.9368, -75.2761, "Check-in 15:00 · Check-out 12:00"],
];

const restaurantSeeds = [
  ["Restaurante Asado Huilense", "Asado huilense tradicional con insulso, envuelto de maduro y bebidas de la casa.", 48000, 5, 2.9362, -75.2791, "12:00–22:00"],
  ["Sabor Opita", "Almuerzos caseros con ingredientes del Huila: tilapia, cerdo, yuca y ají de la casa.", 32000, 4, 2.9318, -75.2834, "11:00–21:00"],
  ["La Casa del Achira", "Desayunos y onces con achiras, cuajadas, café huilense y pan artesanal.", 22000, 5, 2.9396, -75.2766, "07:00–19:00"],
  ["Restaurante El Faro del Magdalena", "Pescados de río y mariscos con vista al malecón, ideal para cenas especiales.", 76000, 5, 2.9258, -75.2866, "12:00–23:00"],
  ["Comidas Típicas Doña Emilia", "Recetas de familia: mote, masato, chicha y platos de cuchara.", 28000, 4, 2.9418, -75.2882, "10:00–20:00"],
  ["Café La Ceiba", "Café de especialidad del Huila, repostería y brunch durante todo el día.", 26000, 5, 2.9333, -75.2748, "07:30–20:00"],
  ["Parrilla Los Arrayanes", "Cortes a la parrilla, chorizos y papas rústicas en un ambiente campestre.", 65000, 4, 2.9477, -75.2903, "12:00–22:30"],
  ["Restaurante Vegano Guacamayo", "Bowl, hamburguesas y postres 100% vegetales con productos locales.", 36000, 5, 2.9307, -75.2799, "11:30–21:00"],
  ["Pizzería El Tizón", "Pizzas de masa madre horneadas en leña, ensaladas y cerveza artesanal.", 42000, 4, 2.9388, -75.2833, "17:00–23:00"],
  ["Mercado Gourmet Neiva", "Plaza de comida con arepas, sushi, parrilla y jugos naturales.", 30000, 4, 2.9352, -75.2805, "10:00–22:00"],
  ["Restaurante Mirador La Concha", "Cocina de autor con vista a la ciudad, menú de temporada y coctelería.", 88000, 5, 2.9534, -75.2721, "18:00–23:30"],
  ["Food Truck Ruta 45", "Comida rápida de autor: hamburguesas, tacos y salchipapas con salsa huilense.", 25000, 4, 2.9269, -75.2758, "17:00–00:00"],
];

const recreationSeeds = [
  ["Desierto de la Tatacoa Stargazing", "Tour nocturno guiado por el desierto con telescopios, mitos y observación del cielo.", 120000, 5, 3.2318, -75.1632, "18:00–23:00", "6 horas"],
  ["Represa de Betania Kayak", "Remada guiada por la represa, chaleco, hidratación y fotos incluidas.", 95000, 5, 2.6544, -75.4468, "08:00–12:00", "4 horas"],
  ["Cañón del Magdalena Hike", "Caminata por el cañón con guía local, miradores y baño en pozos naturales.", 85000, 5, 2.9038, -75.3012, "07:00–13:00", "6 horas"],
  ["Termales de Rivera", "Día de aguas termales, almuerzo típico y senderos entre montañas.", 70000, 4, 2.7822, -75.2612, "09:00–18:00", "9 horas"],
  ["Parque Arqueológico Alto Magdalena", "Recorrido por esculturas y vestigios de culturas prehispánicas con arqueólogo.", 45000, 5, 2.8762, -75.3318, "09:00–13:00", "4 horas"],
  ["Ruta del Café Huilense", "Visita a finca cafetera, proceso del grano, cata y almuerzo campesino.", 110000, 5, 2.9674, -75.2422, "08:00–16:00", "8 horas"],
  ["Río Magdalena Paseo en Lancha", "Paseo en lancha por el Magdalena al atardecer con guía y música local.", 65000, 4, 2.9248, -75.2902, "16:00–18:30", "2.5 horas"],
  ["Museo de la Cultura Huilense", "Entrada guiada al museo, taller de arte y recorrido por la historia del Huila.", 30000, 5, 2.9366, -75.2772, "10:00–17:00", "3 horas"],
  ["Parque del Amor Mirador", "Tour urbano por el mirador, el malecón y los murales de Neiva.", 40000, 4, 2.9382, -75.2712, "17:00–20:00", "3 horas"],
  ["Cicloturismo por Neiva", "Bici tour por el centro histórico, parques y riberas del Magdalena.", 55000, 4, 2.9345, -75.2809, "07:30–11:30", "4 horas"],
  ["Cuevas de los Guácharos", "Espeleología suave con casco, linterna y guía especializado en fauna.", 130000, 5, 2.8654, -75.3484, "08:00–14:00", "6 horas"],
  ["Avistamiento de Aves Río Las Ceibas", "Salida al amanecer con binoculares y guía de aves del bosque seco.", 90000, 5, 2.9742, -75.2462, "05:30–10:30", "5 horas"],
];

const productSeeds = {
  hotel: [
    ["Escapada romántica 2 noches", "Dos noches en hotel boutique, cena para dos y late check-out.", 620000, 390000, 18],
    ["Noche de lujo en Neiva", "Suite con vista, desayuno buffet, spa y coctel de bienvenida.", 480000, 300000, 12],
    ["Plan familiar hotel + desayuno", "Habitación familiar, desayuno para cuatro y paseo por el malecón.", 550000, 360000, 22],
    ["Suite ejecutiva con vista al río", "Suite ejecutiva, escritorio, wifi de fibra y desayuno express.", 430000, 270000, 15],
    ["Pasadía ecológico en la Tatacoa", "Hospedaje ecológico + tour astronómico y desayuno campesino.", 395000, 245000, 20],
    ["Hostal mochilero 3 noches", "Cama en habitación compartida, cocina y tour urbano incluido.", 210000, 130000, 30],
    ["Retiro de bienestar 2 días", "Yoga, meditación, alimentación saludable y masaje relajante.", 720000, 470000, 10],
    ["Fin de semana de aventura", "Dos noches + kayak + caminata guiada por el cañón.", 690000, 450000, 14],
    ["Hospedaje para grupos", "Habitaciones múltiples para hasta 12 personas con desayuno.", 1250000, 820000, 8],
    ["Luna de miel huilense", "Suite nupcial, cena maridaje, flores y fotografía del recuerdo.", 890000, 590000, 9],
    ["Noche de estrellas + desayuno", "Noche en la Tatacoa con telescopio, fogata y desayuno.", 360000, 220000, 24],
    ["Late check-out y spa", "Noche de hotel, masaje de 60 minutos y late check-out.", 415000, 260000, 16],
  ],
  restaurant: [
    ["Ruta gastronómica opita", "Degustación de cinco paradas por sabores tradicionales del Huila.", 155000, 95000, 24],
    ["Asado huilense para 2", "Asado completo, insulso, bebidas y postre para dos personas.", 98000, 58000, 40],
    ["Cena romántica junto al río", "Menú de tres tiempos, vino y mesa privada frente al Magdalena.", 185000, 115000, 16],
    ["Almuerzo típico para grupos", "Almuerzo opita para grupos de hasta 10 personas.", 240000, 150000, 20],
    ["Tour de café y postres", "Cata de café huilense, postres artesanales y visita a tostadora.", 85000, 50000, 30],
    ["Parrillada familiar", "Parrillada para cuatro con cortes, chorizo y acompañamientos.", 220000, 140000, 18],
    ["Menú vegetariano del Huila", "Tres tiempos vegetarianos con productos de la región.", 62000, 36000, 35],
    ["Cata de achiras y vinos", "Maridaje de achiras, quesos y vinos colombianos.", 120000, 72000, 22],
    ["Desayuno típico + city tour", "Desayuno opita y caminata guiada por el centro histórico.", 75000, 45000, 28],
    ["Cena maridaje con café", "Cena de autor maridada con café de especialidad del Huila.", 195000, 125000, 14],
    ["Picnic en el mirador", "Canasta de picnic, manta, música y vista panorámica.", 110000, 68000, 25],
    ["Experiencia chef por un día", "Clase de cocina huilense con chef y almuerzo incluido.", 165000, 100000, 12],
  ],
  recreation: [
    ["Tatacoa astronómica 2D/1N", "Tour astronómico, hospedaje en el desierto y desayuno.", 320000, 200000, 16],
    ["Kayak en Betania", "Salida guiada en kayak, equipo, hidratación y fotos.", 120000, 70000, 28],
    ["Senderismo al Cañón", "Caminata guiada, seguro, refrigerio y baño en pozos.", 105000, 62000, 30],
    ["Termales relax day pass", "Transporte, entrada a termales y almuerzo típico.", 95000, 55000, 36],
    ["Ruta arqueológica guiada", "Entrada, guía arqueólogo y taller de cerámica.", 68000, 38000, 32],
    ["Café experience", "Finca cafetera, cata, almuerzo y recorrido por el paisaje.", 135000, 80000, 26],
    ["Lancha por el Magdalena", "Paseo en lancha al atardecer con guía y bebida.", 78000, 45000, 34],
    ["Museo + taller de arte", "Entrada al museo y taller creativo para todas las edades.", 52000, 30000, 40],
    ["Bici tour urbano", "Bicicleta, casco, guía y paradas fotográficas por Neiva.", 65000, 38000, 30],
    ["Espeleología en guácharos", "Casco, linterna, guía y seguro para explorar la cueva.", 150000, 90000, 20],
    ["Birdwatching al amanecer", "Guía de aves, binoculares y desayuno campesino.", 115000, 68000, 22],
    ["Campamento bajo las estrellas", "Carpa, cena, fogata y observación astronómica.", 190000, 115000, 18],
  ],
};

function buildServices() {
  const roles = [
    { category: "hotel", seeds: hotelSeeds, imageOffset: 0, priceType: "noche", duration: "1 noche", capacity: [1, 4], difficulty: null },
    { category: "restaurant", seeds: restaurantSeeds, imageOffset: 12, priceType: "persona", duration: "1.5 horas", capacity: [1, 12], difficulty: null },
    { category: "recreation", seeds: recreationSeeds, imageOffset: 24, priceType: "persona", duration: "medio día", capacity: [2, 15], difficulty: null },
  ];
  const services = [];
  for (const role of roles) {
    role.seeds.forEach((seed, index) => {
      const [name, description, price, rating, lat, lng, schedule, duration] = seed;
      services.push({
        category: role.category,
        name,
        description,
        price,
        rating,
        lat,
        lng,
        schedule,
        duration: duration || role.duration,
        priceType: role.priceType,
        minCapacity: role.capacity[0],
        maxCapacity: role.capacity[1],
        difficulty: role.difficulty,
        imageIndex: role.imageOffset + index,
        included: role.category === "hotel"
          ? ["Desayuno", "WiFi", "Parqueadero"]
          : role.category === "restaurant"
            ? ["Reserva de mesa", "Bebida de bienvenida"]
            : ["Guía local", "Seguro", "Hidratación"],
        whatToBring: role.category === "recreation" ? "Ropa cómoda, protector solar y agua" : "Documento de identidad",
      });
    });
  }
  return services;
}

function buildProducts() {
  const offsets = { hotel: 36, restaurant: 48, recreation: 60 };
  const products = [];
  for (const roleCategory of ["hotel", "restaurant", "recreation"]) {
    productSeeds[roleCategory].forEach((seed, index) => {
      const [name, description, price, cost, stock] = seed;
      products.push({
        roleCategory,
        name,
        description,
        price,
        cost,
        stock,
        imageIndex: offsets[roleCategory] + index,
        modelIndex: roleCategory === "recreation" ? index : null,
        lat: NEIVA_CENTER.lat + (index - 6) * 0.0042 + (roleCategory === "hotel" ? 0.004 : 0),
        lng: NEIVA_CENTER.lng + (index - 6) * 0.0038 - (roleCategory === "restaurant" ? 0.003 : 0),
      });
    });
  }
  return products;
}

export const NEIVA_DATA = {
  hotels: hotelSeeds,
  restaurants: restaurantSeeds,
  recreations: recreationSeeds,
  services: buildServices(),
  products: buildProducts(),
  demoUser: {
    username: "josedavidcorreanunez123@gmail.com",
    email: "josedavidcorreanunez123@gmail.com",
    name: "José David Correo Núñez",
    password: process.env.SEED_DEMO_PASSWORD || "",
    roles: ["traveler", "hotel", "restaurant", "recreation"],
  },
};

export function assetHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}
