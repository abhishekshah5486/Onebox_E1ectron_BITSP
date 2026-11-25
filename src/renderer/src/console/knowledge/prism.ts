// A glass prism splitting a beam of white light, traced per wavelength with Snell's law at
// each face. The prism sways slowly, so the spectrum sweeps as a real one does.

type V = [number, number];

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const unit = (a: V): V => {
  const l = Math.hypot(a[0], a[1]);
  return [a[0] / l, a[1] / l];
};

const WAVELENGTHS = Array.from({ length: 40 }, (_, i) => 0.4 + (0.3 * i) / 39);

// Cauchy's equation, with the glass's dispersion exaggerated so the fan reads at icon size.
const index = (micrometres: number) => 1.4 + 0.03 / (micrometres * micrometres);

// The colour of a wavelength, faded at the ends of the visible range.
function colour(micrometres: number): [number, number, number] {
  const w = micrometres * 1000;
  let r = 0;
  let g = 0;
  let b = 0;
  if (w < 440) [r, b] = [-(w - 440) / 40, 1];
  else if (w < 490) [g, b] = [(w - 440) / 50, 1];
  else if (w < 510) [g, b] = [1, -(w - 510) / 20];
  else if (w < 580) [r, g] = [(w - 510) / 70, 1];
  else if (w < 645) [r, g] = [1, -(w - 645) / 65];
  else r = 1;
  const edge = w < 420 ? 0.3 + (0.7 * (w - 400)) / 20 : w > 680 ? 0.3 + (0.7 * (700 - w)) / 20 : 1;
  return [r * edge * 255, g * edge * 255, b * edge * 255].map(Math.round) as [
    number,
    number,
    number,
  ];
}

// Where a ray first meets an edge of the triangle, other than the one it leaves from.
function hit(origin: V, dir: V, tri: V[], skip: number) {
  let best: { t: number; edge: number; at: V } | null = null;
  for (let i = 0; i < 3; i++) {
    if (i === skip) continue;
    const a = tri[i]!;
    const e = sub(tri[(i + 1) % 3]!, a);
    const den = dir[0] * e[1] - dir[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const ao = sub(a, origin);
    const t = (ao[0] * e[1] - ao[1] * e[0]) / den;
    const u = (ao[0] * dir[1] - ao[1] * dir[0]) / den;
    if (t > 1e-6 && u >= 0 && u <= 1 && (!best || t < best.t))
      best = { t, edge: i, at: add(origin, dir, t) };
  }
  return best;
}

function outward(tri: V[], edge: number): V {
  const a = tri[edge]!;
  const e = sub(tri[(edge + 1) % 3]!, a);
  const n = unit([e[1], -e[0]]);
  const centre: V = [
    (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3,
    (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3,
  ];
  return dot(n, sub(a, centre)) > 0 ? n : [-n[0], -n[1]];
}

// Snell's law, with `normal` facing the incoming ray; null on total internal reflection.
function refract(dir: V, normal: V, eta: number): V | null {
  const cos = -dot(normal, dir);
  const k = 1 - eta * eta * (1 - cos * cos);
  if (k < 0) return null;
  return add([dir[0] * eta, dir[1] * eta], normal, eta * cos - Math.sqrt(k));
}

export function drawPrism(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  dark: boolean,
) {
  ctx.clearRect(0, 0, width, height);
  const centre: V = [width * 0.34, height * 0.5];
  const radius = height * 0.4;
  const turn = -Math.PI / 2 + Math.sin(time * 0.00035) * 0.1;
  const tri = [0, 1, 2].map((i): V => [
    centre[0] + radius * Math.cos(turn + (i * 2 * Math.PI) / 3),
    centre[1] + radius * Math.sin(turn + (i * 2 * Math.PI) / 3),
  ]);
  // Aimed at the middle of the lit face, rising about 20 degrees: near minimum deviation, so
  // the spectrum leaves roughly level.
  const aim = add(tri[2]!, sub(tri[0]!, tri[2]!), 0.5);
  const source: V = [-2, aim[1] + (aim[0] + 2) * Math.tan((20 * Math.PI) / 180)];
  const dir = unit(sub(aim, source));
  const entry = hit(source, dir, tri, -1);
  if (!entry) return;
  const inNormal = outward(tri, entry.edge);
  const shimmer = 0.9 + 0.1 * Math.sin(time * 0.002);

  const rays = WAVELENGTHS.flatMap((w) => {
    const n = index(w);
    const inside = refract(dir, inNormal, 1 / n);
    if (!inside) return [];
    const exit = hit(entry.at, inside, tri, entry.edge);
    if (!exit) return [];
    const exitNormal = outward(tri, exit.edge);
    const out = refract(inside, [-exitNormal[0], -exitNormal[1]], n);
    if (!out) return [];
    return [{ rgb: colour(w), exit: exit.at, end: add(exit.at, out, width * 1.5) }];
  });

  // The spectrum, added as light on dark pages, fading out to the right.
  ctx.save();
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  ctx.lineCap = 'round';
  for (const [lineWidth, alpha] of [
    [7, dark ? 0.05 : 0.04],
    [2.4, dark ? 0.2 : 0.22],
  ] as const) {
    ctx.lineWidth = lineWidth;
    for (const ray of rays) {
      ctx.strokeStyle = `rgba(${ray.rgb.join(',')},${alpha * shimmer})`;
      ctx.beginPath();
      ctx.moveTo(...ray.exit);
      ctx.lineTo(...ray.end);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createLinearGradient(width * 0.68, 0, width, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(width * 0.68, 0, width * 0.32, height);
  ctx.restore();

  const ink = dark ? '255,255,255' : '70,80,110';

  // The glass: a faint body, lighter toward the lit face.
  const body = ctx.createLinearGradient(tri[0]![0], tri[0]![1], centre[0], centre[1] + radius);
  body.addColorStop(0, dark ? 'rgba(255,255,255,0.16)' : 'rgba(190,205,255,0.32)');
  body.addColorStop(1, dark ? 'rgba(200,220,255,0.04)' : 'rgba(190,205,255,0.12)');
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(...tri[0]!);
    ctx.lineTo(...tri[1]!);
    ctx.lineTo(...tri[2]!);
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = body;
  ctx.fill();

  // The light inside the glass, already starting to part.
  ctx.save();
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  ctx.lineWidth = 1.2;
  for (const ray of rays) {
    ctx.strokeStyle = `rgba(${ray.rgb.join(',')},${dark ? 0.12 : 0.1})`;
    ctx.beginPath();
    ctx.moveTo(...entry.at);
    ctx.lineTo(...ray.exit);
    ctx.stroke();
  }
  ctx.restore();

  // Its edges, with a highlight along the face the light comes from.
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${ink},${dark ? 0.7 : 0.55})`;
  outline();
  ctx.stroke();
  const [a, b] = [tri[entry.edge]!, tri[(entry.edge + 1) % 3]!];
  const inset = (p: V): V => add(p, sub(centre, p), 0.12);
  ctx.beginPath();
  ctx.moveTo(...inset(a));
  ctx.lineTo(...inset(b));
  ctx.strokeStyle = `rgba(255,255,255,${dark ? 0.5 : 0.9})`;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // The white beam, and the little of it the first face reflects.
  ctx.save();
  ctx.lineCap = 'round';
  const beam = ctx.createLinearGradient(source[0], source[1], entry.at[0], entry.at[1]);
  beam.addColorStop(0, `rgba(${dark ? '255,255,255' : '120,130,150'},0)`);
  beam.addColorStop(1, `rgba(${dark ? '255,255,255' : '120,130,150'},${0.95 * shimmer})`);
  for (const [lineWidth, alpha] of [
    [6, 0.12],
    [1.6, 1],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = beam;
    ctx.beginPath();
    ctx.moveTo(...source);
    ctx.lineTo(...entry.at);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const bounce = add(dir, inNormal, -2 * dot(dir, inNormal));
  const reflected = ctx.createLinearGradient(...entry.at, ...add(entry.at, bounce, radius * 0.9));
  reflected.addColorStop(0, `rgba(${ink},0.28)`);
  reflected.addColorStop(1, `rgba(${ink},0)`);
  ctx.strokeStyle = reflected;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(...entry.at);
  ctx.lineTo(...add(entry.at, bounce, radius * 0.9));
  ctx.stroke();
  ctx.restore();

  // Glints where the light meets the glass.
  const glint = (at: V, size: number, alpha: number) => {
    const g = ctx.createRadialGradient(...at, 0, ...at, size);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(at[0] - size, at[1] - size, size * 2, size * 2);
  };
  glint(entry.at, 5, 0.9 * shimmer);
  const middle = rays[Math.floor(rays.length / 2)];
  if (middle) glint(middle.exit, 4, 0.5);
}
