/**
 * Map icons for kinds of places, drawn on a canvas at load time: no sprite files to
 * ship or license. Shapes are single-colour (SDF) so the style can tint them, highlight
 * the selected place and give them a light halo over the relief.
 */

/** OpenBible kind → icon. Kinds not listed keep a plain dot. */
export const KIND_ICON: Readonly<Record<string, string>> = {
  mountain: "hg-mountain",
  hill: "hg-mountain",
  "mountain pass": "hg-mountain",
  cliff: "hg-mountain",
  rock: "hg-mountain",
  promontory: "hg-mountain",
  spring: "hg-spring",
  well: "hg-spring",
  pool: "hg-spring",
  ford: "hg-spring",
  garden: "hg-tree",
  tree: "hg-tree",
  forest: "hg-tree",
  field: "hg-tree",
  gate: "hg-building",
  structure: "hg-building",
  hall: "hg-building",
  room: "hg-building",
  fortification: "hg-building",
  "district in settlement": "hg-building",
  altar: "hg-altar",
  "stone heap": "hg-altar",
  campsite: "hg-tent",
  valley: "hg-valley",
  road: "hg-road",
  // Rivers drawn as lines keep only their line label; the others get this mark.
  river: "hg-river",
  wadi: "hg-river",
  canal: "hg-river",
};

const SIZE = 32; // pixels at pixelRatio 2: 16 css px on the map

type Draw = (c: CanvasRenderingContext2D) => void;

const DRAW: Readonly<Record<string, Draw>> = {
  "hg-mountain": (c) => {
    c.beginPath();
    c.moveTo(2, 28);
    c.lineTo(13, 6);
    c.lineTo(19, 16);
    c.lineTo(22, 11);
    c.lineTo(30, 28);
    c.closePath();
    c.fill();
  },
  "hg-spring": (c) => {
    c.beginPath();
    c.moveTo(16, 3);
    c.bezierCurveTo(16, 3, 6, 15, 6, 20);
    c.arc(16, 20, 10, Math.PI, 0, true);
    c.bezierCurveTo(26, 15, 16, 3, 16, 3);
    c.fill();
  },
  "hg-tree": (c) => {
    c.beginPath();
    c.arc(16, 12, 10, 0, Math.PI * 2);
    c.fill();
    c.fillRect(13.5, 18, 5, 12);
  },
  "hg-building": (c) => {
    c.beginPath();
    c.moveTo(4, 14);
    c.lineTo(16, 4);
    c.lineTo(28, 14);
    c.lineTo(28, 29);
    c.lineTo(4, 29);
    c.closePath();
    c.fill();
    c.clearRect(13, 19, 6, 10); // a door
  },
  "hg-altar": (c) => {
    c.fillRect(5, 12, 22, 17);
    c.fillRect(3, 9, 26, 4);
    c.beginPath(); // a flame
    c.moveTo(16, 1);
    c.quadraticCurveTo(22, 6, 16, 9);
    c.quadraticCurveTo(10, 6, 16, 1);
    c.fill();
  },
  "hg-tent": (c) => {
    c.beginPath();
    c.moveTo(2, 29);
    c.lineTo(16, 4);
    c.lineTo(30, 29);
    c.closePath();
    c.fill();
    c.beginPath(); // the opening
    c.moveTo(16, 14);
    c.lineTo(11, 29);
    c.lineTo(21, 29);
    c.closePath();
    c.globalCompositeOperation = "destination-out";
    c.fill();
    c.globalCompositeOperation = "source-over";
  },
  "hg-valley": (c) => {
    c.lineWidth = 5;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(3, 7);
    c.lineTo(16, 26);
    c.lineTo(29, 7);
    c.stroke();
  },
  "hg-river": (c) => {
    c.lineWidth = 4;
    c.lineCap = "round";
    for (const y of [11, 21]) {
      c.beginPath();
      c.moveTo(3, y);
      c.bezierCurveTo(9, y - 6, 13, y + 6, 18, y);
      c.bezierCurveTo(22, y - 5, 26, y + 4, 29, y);
      c.stroke();
    }
  },
  // Two swords crossed: a battle or a siege (content/battles.yaml).
  "hg-battle": (c) => {
    c.lineCap = "round";
    for (const flip of [1, -1]) {
      c.save();
      c.translate(16, 16);
      c.scale(flip, 1);
      c.rotate(-Math.PI / 4);
      // Blade, then the guard across it and the grip.
      c.lineWidth = 3.6;
      c.beginPath();
      c.moveTo(0, -14);
      c.lineTo(0, 7);
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-5, 7);
      c.lineTo(5, 7);
      c.moveTo(0, 7);
      c.lineTo(0, 13);
      c.stroke();
      c.restore();
    }
  },
  "hg-road": (c) => {
    c.lineWidth = 4;
    c.lineCap = "round";
    c.setLineDash([6, 5]);
    c.beginPath();
    c.moveTo(4, 28);
    c.quadraticCurveTo(24, 22, 16, 14);
    c.quadraticCurveTo(8, 6, 28, 4);
    c.stroke();
  },
};

export const ICON_NAMES = Object.keys(DRAW);

/** The icon as a data URL in a given colour, for HTML (the map legend). */
export function iconDataUrl(name: string, color: string): string | null {
  const draw = DRAW[name];
  if (!draw) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.fillStyle = color;
  c.strokeStyle = color;
  draw(c);
  return canvas.toDataURL();
}

const PAD = 5; // pixels of room around the shape for the halo
const SDF_RADIUS = 8; // MapLibre's SDF scale: 8 px of distance over the alpha range

/**
 * The icon as a signed distance field, as MapLibre expects for `sdf: true`: alpha 0.75 on
 * the outline, rising inside and falling outside by 1/8 per pixel. A hard-edged bitmap
 * would leave the halo a sub-pixel ring. Needs a DOM canvas.
 */
export function drawIcon(name: string): ImageData | null {
  const draw = DRAW[name];
  if (!draw) return null;
  const size = SIZE + 2 * PAD;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.fillStyle = "#000";
  c.strokeStyle = "#000";
  c.translate(PAD, PAD);
  draw(c);
  const img = c.getImageData(0, 0, size, size);
  const inside = new Uint8Array(size * size);
  for (let k = 0; k < size * size; k++) inside[k] = (img.data[k * 4 + 3] ?? 0) > 127 ? 1 : 0;
  const out = new ImageData(size, size);
  const reach = SDF_RADIUS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const me = inside[y * size + x];
      // Distance to the nearest pixel on the other side of the outline (brute force: tiny images).
      let best = reach * reach;
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) continue;
        for (let dx = -reach; dx <= reach; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= size || inside[yy * size + xx] === me) continue;
          const d = dx * dx + dy * dy;
          if (d < best) best = d;
        }
      }
      const dist = (Math.sqrt(best) - 0.5) * (me ? -1 : 1);
      const a = Math.min(1, Math.max(0, 1 - (dist / SDF_RADIUS + 0.25)));
      out.data[(y * size + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  return out;
}
